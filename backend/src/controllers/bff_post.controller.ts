import { Request, Response, NextFunction } from "express";
import { PostService } from "../services/post.service";
import { uploadMultiple } from "../middlewares/upload.middleware";
import { PostType } from "../models/community_post.model";
import { transformMediaURLs, uploadMultipleFilesToCloudinary } from "../utils/media.util";
import { NotFoundError } from "../errors";

// Helper để upload file, sau đó controller mới xử lý
export const uploadPostImages = uploadMultiple;

export const createPost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const files = req.files as Express.Multer.File[];
        const { type, title, content, location, contact_info, dog_id } = req.body;

        if (!files || files.length === 0) {
            // Cho phép tạo bài viết không ảnh? NO, gatekeeper cần ảnh.
            return res.status(400).send({ message: "Vui lòng tải lên ít nhất 1 ảnh rõ nét của chó." });
        }

        // Parse JSON strings from FormData
        let parsedLocation;
        let parsedContact;

        try {
            parsedLocation = typeof location === 'string' ? JSON.parse(location) : location;
            parsedContact = typeof contact_info === 'string' ? JSON.parse(contact_info) : contact_info;
        } catch (e) {
            return res.status(400).send({ message: "Invalid JSON format for location or contact_info." });
        }

        const uploadedUrls = await uploadMultipleFilesToCloudinary(files, 'posts');

        const postData = {
            type: type as PostType,
            title,
            content,
            photos: uploadedUrls,
            dog_id,
            location: parsedLocation,
            contact_info: parsedContact
        };

        const post = await PostService.createPost(postData, req.user?.id as string, req);
        res.status(201).send(post);

    } catch (err) {
        next(err);
    }
};



export const getPosts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type, breed, lat, lng, radius, limit, page } = req.query;

        const result = await PostService.getPosts({
            type: type as PostType,
            breed: breed as string,
            lat: lat ? Number(lat) : undefined,
            lng: lng ? Number(lng) : undefined,
            radius: radius ? Number(radius) : undefined
        }, Number(page) || 1, Number(limit) || 20);

        const transformedData = result.data.map(post => transformMediaURLs(req, post));
        res.send({ data: transformedData, total: result.total });
    } catch (err) {
        console.error("getPosts Error:", err);
        next(err);
    }
};

export const resolvePost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const post = await PostService.markAsResolved(req.params.id, req.user?.id as string);
        res.send(transformMediaURLs(req, post));
    } catch (err) {
        next(err);
    }
};

export const getRadar = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { lat, lng, radius, breed, sourceType } = req.query;
        if (!lat || !lng) {
            return res.status(400).send({ message: "Latitude and Longitude are required." });
        }

        // sourceType determines what to search: LOST source → find FOUND, FOUND source → find LOST
        const postType = sourceType === "FOUND" ? PostType.FOUND : (sourceType === "LOST" ? PostType.LOST : undefined);

        try {
            const posts = await PostService.getRadarPosts(
                Number(lat),
                Number(lng),
                Number(radius) || 10,
                breed as string,
                postType
            );

            // Convert Mongoose documents to plain objects and transform URLs
            const transformedPosts = posts.map(post => {
                const plainPost = typeof post.toJSON === 'function' ? post.toJSON() : post;
                return transformMediaURLs(req, plainPost);
            });

            res.send(transformedPosts);
        } catch (queryError: any) {
            // Handle MongoDB geo-query errors (e.g., no 2dsphere index, no documents in collection)
            console.error("Radar Query Error:", queryError.message);
            // Return empty array instead of 500 error
            res.send([]);
        }
    } catch (err) {
        console.error("getRadar Error:", err);
        next(err);
    }
};
// --- Legacy/CRUD Wrappers ---

export const getPost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const post = await PostService.getPostById(req.params.id);
        if (!post) {
            throw new NotFoundError();
        }
        res.send(transformMediaURLs(req, post));
    } catch (err) {
        next(err);
    }
};

export const updatePost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const post = await PostService.updatePost(req.params.id, req.user!.id, req.body);
        res.send(post);
    } catch (err) {
        next(err);
    }
};

export const deletePost = async (req: Request, res: Response, next: NextFunction) => {
    try {
        await PostService.deletePost(req.params.id, req.user!.id);
        res.status(204).send({});
    } catch (err) {
        next(err);
    }
};
