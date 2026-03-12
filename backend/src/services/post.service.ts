import { CommunityPost, CommunityPostDoc, PostType, PostStatus } from "../models/community_post.model";
import { NotFoundError, NotAuthorizedError, BadRequestError } from "../errors";
import { predictionService } from "../services/prediction.service";
import { MatchingService } from "../services/matching.service";
import { DogProfile } from "../models/dog_profile.model";

// Helper: Convert breed name to slug format for consistent comparison
function toSlug(str: string): string {
    return str.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]+/g, '').trim();
}

interface CreatePostDTO {
    type: PostType;
    title: string;
    content: string;
    photos?: string[]; // URLs from Cloudinary
    dog_id?: string;
    location?: {
        lat: number;
        lng: number;
        address: string;
    };
    contact_info: {
        name: string;
        phone?: string;
        email?: string;
    };
}

interface FilterOptions {
    type?: PostType;
    breed?: string;
    color?: string; // Re-add color for backward compatibility / controller
    minPrice?: number;
    maxPrice?: number;
    status?: PostStatus;
    lat?: number;
    lng?: number;
    radius?: number; // km
}

export class PostService {

    static async createPost(data: CreatePostDTO, authorId: string, req: any, trustedAiMetadata?: any): Promise<CommunityPostDoc> {

        // --- AI GATEKEEPER & AUTO-FILL ---
        let aiMetadata: {
            breed: string;
            breed_slug: string;
            confidence: number;
            color: string;
            verificationType?: 'camera' | 'qr';
        } = {
            breed: "Unknown",
            breed_slug: "unknown",
            confidence: 0,
            color: "Unknown"
        };

        // If trusted metadata is provided (e.g. from System/Owner Report Lost), use it
        if (trustedAiMetadata) {
            aiMetadata = trustedAiMetadata;
        } else if (data.dog_id) {
            // QR Scan scenario: Get metadata from linked DogProfile
            const linkedDog = await DogProfile.findById(data.dog_id);
            if (linkedDog) {
                aiMetadata = {
                    breed: linkedDog.breed,
                    breed_slug: toSlug(linkedDog.breed),
                    confidence: 1.0, // Trusted from profile
                    color: linkedDog.attributes?.color || "Unknown",
                    verificationType: 'qr' as const
                };
                // Use dog's photos if no photos provided
                if (!data.photos || data.photos.length === 0) {
                    data.photos = linkedDog.photos?.length > 0
                        ? linkedDog.photos
                        : (linkedDog.avatarPath ? [linkedDog.avatarPath] : []);
                }
            } else {
                throw new BadRequestError("Linked dog profile not found.");
            }
        } else {
            // Validate: Must have at least one photo for AI check
            if (!data.photos || data.photos.length === 0) {
                throw new BadRequestError("Post must have at least one photo for AI verification.");
            }

            const mainPhotoUrl = data.photos[0];

            try {
                // 1. Call AI Service to analyze the image URL
                const predictionHistory = await predictionService.makeUrlPrediction(authorId as any, mainPhotoUrl, req);

                // 2. Check Results
                if (!predictionHistory.predictions || predictionHistory.predictions.length === 0) {
                    throw new BadRequestError("AI did not detect any dog in the image. Please upload a clear dog photo.");
                }

                const topPrediction = predictionHistory.predictions[0];

                // 3. Gatekeeper: Min Confidence Check (e.g., 40%)
                if (topPrediction.confidence < 0.4) {
                    throw new BadRequestError("The image is not clear enough or does not contain a dog (Low confidence).");
                }

                // 4. Auto-fill Metadata
                aiMetadata = {
                    breed: topPrediction.class,
                    breed_slug: toSlug(topPrediction.class),
                    confidence: topPrediction.confidence,
                    color: "Unknown" // Future: Get color from attributes if available
                };

            } catch (error: any) {
                // Re-throw BadRequest errors (Gatekeeper rejections)
                if (error instanceof BadRequestError) throw error;

                console.error("AI Gatekeeper Error:", error);
                throw new BadRequestError("AI Verification failed. Could not process image.");
            }
        }

        // --- CREATE POST ---
        const locationGeoJSON = data.location ? {
            type: "Point" as const,
            coordinates: [data.location.lng, data.location.lat],
            address: data.location.address
        } : undefined;

        if (!locationGeoJSON) throw new BadRequestError("Location is required.");

        const post = await CommunityPost.create({
            author_id: authorId,
            type: data.type,
            status: PostStatus.OPEN,
            title: data.title,
            content: data.content,
            photos: data.photos,
            dog_id: data.dog_id,
            location: locationGeoJSON,
            contact_info: data.contact_info,
            ai_metadata: aiMetadata
        });

        // --- MATCHING SERVICE TRIGGER ---
        // Fire and forget (Async) - Now includes authorId for email notification
        MatchingService.findPotentialMatches({
            type: post.type,
            breed: aiMetadata.breed,
            longitude: locationGeoJSON.coordinates[0],
            latitude: locationGeoJSON.coordinates[1],
            distanceInKm: 10,
            authorId: authorId // Pass authorId for email notification
        }).then(matches => {
            if (matches.length > 0) {
                console.log(`[MatchingService] Found ${matches.length} potential matches for Post ${post._id}. Email sent to author.`);
            }
        });

        return post;
    }

    static async getPosts(filters: FilterOptions, page: number = 1, limit: number = 20, view: string = 'list'): Promise<{ data: CommunityPostDoc[], total: number }> {
        const query: any = {
            status: filters.status || PostStatus.OPEN,
            isDeleted: { $ne: true }
        };

        if (filters.type) {
            query.type = filters.type;
        }

        if (filters.breed) {
            // Use breed_slug for exact matching, fallback to regex on breed for backward compatibility
            query["ai_metadata.breed_slug"] = toSlug(filters.breed);
        }

        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            query["sale_info.price"] = {};
            if (filters.minPrice !== undefined) query["sale_info.price"].$gte = filters.minPrice;
            if (filters.maxPrice !== undefined) query["sale_info.price"].$lte = filters.maxPrice;
        }

        // Geospatial Logic
        let isGeospatial = false;
        const countQuery = { ...query };

        if (filters.lat && filters.lng && filters.radius) {
            isGeospatial = true;
            // $near for finding (Sorts by distance automatically)
            query.location = {
                $near: {
                    $geometry: {
                        type: "Point",
                        coordinates: [filters.lng, filters.lat]
                    },
                    $maxDistance: filters.radius * 1000 // meters
                }
            };

            // $geoWithin for counting (Does not sort, allowed in countDocuments)
            countQuery.location = {
                $geoWithin: {
                    $centerSphere: [
                        [filters.lng, filters.lat],
                        filters.radius / 6378.1 // Convert km to radians
                    ]
                }
            };
        }

        const skip = (page - 1) * limit;
        let dbQuery = CommunityPost.find(query);

        // Apply Sort ONLY if NOT geospatial (because $near already sorts by distance)
        if (!isGeospatial) {
            dbQuery = dbQuery.sort({ createdAt: -1 });
        }

        if (view === 'map_radar') {
            dbQuery.select("location type ai_metadata photos createdAt _id");
        }

        dbQuery = dbQuery.skip(skip).limit(limit);

        const [data, total] = await Promise.all([
            dbQuery,
            CommunityPost.countDocuments(countQuery)
        ]);

        return { data, total };
    }

    /**
     * Get radar posts for map visualization
     * @param lat Latitude of center point
     * @param lng Longitude of center point  
     * @param radius Radius in km (default 10)
     * @param breed Filter by breed (optional)
     * @param sourceType The type of the source post (LOST or FOUND) - determines what to search for
     *                   If sourceType=LOST, search for FOUND posts (default behavior)
     *                   If sourceType=FOUND, search for LOST posts
     */
    static async getRadarPosts(lat: number, lng: number, radius: number = 10, breed?: string, sourceType?: PostType): Promise<CommunityPostDoc[]> {
        // Bi-directional: If viewing a LOST post, show FOUND results. If viewing FOUND, show LOST.
        const targetType = sourceType === PostType.FOUND ? PostType.LOST : PostType.FOUND;

        const query: any = {
            status: PostStatus.OPEN,
            type: targetType,
            isDeleted: { $ne: true }
        };

        if (breed) {
            query["ai_metadata.breed_slug"] = toSlug(breed);
        }

        query.location = {
            $near: {
                $geometry: {
                    type: "Point",
                    coordinates: [lng, lat]
                },
                $maxDistance: radius * 1000
            }
        };

        return await CommunityPost.find(query)
            .select("location type ai_metadata photos createdAt _id title contact_info")
            .limit(50);
    }

    static async getPostById(id: string): Promise<CommunityPostDoc | null> {
        const post = await CommunityPost.findByIdAndUpdate(
            id,
            { $inc: { views: 1 } },
            { new: true }
        ).populate("dog_id");
        return post;
    }

    static async updatePost(id: string, authorId: string, updateData: Partial<CommunityPostDoc>): Promise<CommunityPostDoc> {
        const post = await CommunityPost.findById(id);
        if (!post) throw new NotFoundError("Post not found");
        if (post.author_id !== authorId) throw new NotAuthorizedError();

        Object.assign(post, updateData);
        await post.save();
        return post;
    }

    static async deletePost(id: string, authorId: string): Promise<void> {
        const post = await CommunityPost.findById(id);
        if (!post) throw new NotFoundError("Post not found");
        if (post.author_id !== authorId) throw new NotAuthorizedError();

        await post.deleteOne();
    }

    static async markAsResolved(id: string, authorId: string): Promise<CommunityPostDoc> {
        const post = await CommunityPost.findById(id);
        if (!post) throw new NotFoundError("Post not found");
        if (post.author_id !== authorId) throw new NotAuthorizedError();

        post.status = PostStatus.RESOLVED;
        post.isDeleted = true;
        await post.save();

        // If it was a LOST post and had a linked dog profile, mark dog as FOUND (isLost = false)
        if (post.type === PostType.LOST && post.dog_id) {
            await DogProfile.findByIdAndUpdate(post.dog_id, { isLost: false });
        }

        return post;
    }

    static async resolvePostsByDogId(dogId: string): Promise<void> {
        await CommunityPost.updateMany(
            { dog_id: dogId, status: PostStatus.OPEN },
            {
                $set: {
                    status: PostStatus.RESOLVED,
                    isDeleted: true
                }
            }
        );
    }
}
