import { CommunityPost, CommunityPostDoc, PostType, PostStatus } from "../models/community_post.model";
import { NotFoundError, NotAuthorizedError } from "../errors";
// import { PredictionService } from "../services/prediction.service"; // Giả sử bạn có service này để gọi AI

interface CreatePostDTO {
    type: PostType;
    title: string;
    content: string;
    photos?: string[];
    dog_id?: string;
    tags?: {
        breed?: string;
        color?: string;
        price?: number;
    };
    location?: {
        lat: number;
        lng: number;
        address: string;
    };
    contact_info: {
        phone?: string;
        email?: string;
        facebook?: string;
    };
}

interface FilterOptions {
    type?: PostType;
    breed?: string;
    color?: string;
    minPrice?: number;
    maxPrice?: number;
    status?: PostStatus;
}

export class PostService {

    static async createPost(data: CreatePostDTO, authorId: string): Promise<CommunityPostDoc> {

        // --- AI VERIFICATION LOGIC START ---
        let aiVerification = undefined;

        // Chỉ chạy AI check nếu user có khai báo giống (breed) và có ảnh
        if (data.tags?.breed && data.photos && data.photos.length > 0) {
            try {
                // 1. Lấy ảnh đầu tiên để check
                const mainPhotoUrl = data.photos[0];

                // 2. Gọi AI Service (Giả lập logic gọi hàm predict)
                // const aiResult = await PredictionService.predictFromUrl(mainPhotoUrl);

                // --- MOCKUP AI RESULT (Vì chưa import được service thật ở đây) ---
                // Giả sử AI trả về kết quả này
                const mockAiResult = {
                    breed: "Golden Retriever", // Ví dụ AI nhìn thấy Golden
                    confidence: 0.95
                };
                // ----------------------------------------------------------------

                // 3. So sánh giống User khai báo vs AI nhìn thấy
                // Chuẩn hóa chuỗi để so sánh (lowercase, trim)
                const userBreed = data.tags.breed.toLowerCase().trim();
                const aiBreed = mockAiResult.breed.toLowerCase().trim();

                // Logic so sánh đơn giản (có thể dùng string distance để flexible hơn)
                const isMatch = userBreed.includes(aiBreed) || aiBreed.includes(userBreed);

                aiVerification = {
                    isVerified: isMatch,
                    detectedBreed: mockAiResult.breed,
                    confidence: mockAiResult.confidence,
                    checkedAt: new Date()
                };

            } catch (error) {
                console.error("AI Verification Failed:", error);
                // Không fail việc tạo post nếu AI lỗi, chỉ đơn giản là không có verified tag
            }
        }
        // --- AI VERIFICATION LOGIC END ---

        const post = await CommunityPost.create({
            ...data,
            author_id: authorId,
            status: PostStatus.OPEN,
            ai_verification: aiVerification // Lưu kết quả check
        });
        return post;
    }

    static async getPosts(filters: FilterOptions, page: number = 1, limit: number = 20): Promise<{ data: CommunityPostDoc[], total: number }> {
        const query: any = { status: filters.status || PostStatus.OPEN };

        if (filters.type) {
            query.type = filters.type;
        }

        if (filters.breed) {
            query["tags.breed"] = { $regex: filters.breed, $options: "i" };
        }

        if (filters.color) {
            query["tags.color"] = { $regex: filters.color, $options: "i" };
        }

        if (filters.minPrice || filters.maxPrice) {
            query["tags.price"] = {};
            if (filters.minPrice) query["tags.price"].$gte = filters.minPrice;
            if (filters.maxPrice) query["tags.price"].$lte = filters.maxPrice;
        }

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            CommunityPost.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("dog_id", "name avatarPath gender"),
            CommunityPost.countDocuments(query)
        ]);

        return { data, total };
    }

    static async getPostById(id: string): Promise<CommunityPostDoc | null> {
        const post = await CommunityPost.findById(id).populate("dog_id");
        if (post) {
            post.views += 1;
            await post.save();
        }
        return post;
    }

    static async updatePost(id: string, authorId: string, updateData: Partial<CommunityPostDoc>): Promise<CommunityPostDoc> {
        const post = await CommunityPost.findById(id);
        if (!post) throw new NotFoundError("Post not found");
        if (post.author_id !== authorId) throw new NotAuthorizedError();

        Object.assign(post, updateData);

        // Note: Nếu update ảnh hoặc giống, lẽ ra nên chạy lại AI check. 
        // Để đơn giản, ở đây mình chưa implement re-check.

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
        await post.save();
        return post;
    }
}
