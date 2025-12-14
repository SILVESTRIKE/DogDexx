import mongoose, { Schema, Document } from "mongoose";

// BỎ SALE, ADOPTION, GENERAL
export enum PostType {
    LOST = "LOST",
    FOUND = "FOUND"
}

export enum PostStatus {
    OPEN = "OPEN",
    RESOLVED = "RESOLVED",
    CLOSED = "CLOSED"
}

export interface CommunityPostDoc extends Document {
    author_id?: string;
    type: PostType;
    status: PostStatus;
    title: string;
    content: string;
    photos: string[];
    dog_id?: string;

    ai_metadata: {
        breed: string;
        breed_slug: string;
        confidence: number;
        color?: string;
        verificationType?: 'camera' | 'qr';
    };

    // --- GEOJSON STANDARD (Bắt buộc để dùng $near) ---
    location: {
        type: "Point";
        coordinates: number[]; // [longitude, latitude] - Lưu ý thứ tự!
        address?: string;
    };

    contact_info: {
        name: string;
        phone?: string;
        email?: string;
    };
    views: number;
    isDeleted: boolean; // Soft delete flag
    createdAt: Date;
}

const communityPostSchema = new Schema(
    {
        author_id: { type: String, required: false },
        type: {
            type: String,
            enum: Object.values(PostType), // Chỉ còn LOST/FOUND
            required: true,
            index: true
        },
        status: { type: String, enum: Object.values(PostStatus), default: PostStatus.OPEN },
        title: { type: String, required: true },
        content: { type: String, required: true },
        photos: { type: [String], required: true },
        dog_id: { type: String }, // Optional link to DogProfile

        ai_metadata: {
            breed: { type: String, index: "text" }, // Text index for search
            breed_slug: { type: String, index: true }, // For exact match queries
            confidence: Number,
            color: String,
            verificationType: { type: String, enum: ['camera', 'qr'] }
        },

        // Cấu trúc GeoJSON chuẩn
        location: {
            type: {
                type: String,
                enum: ['Point'],
                required: true,
                default: 'Point'
            },
            coordinates: {
                type: [Number], // [Longitude, Latitude]
                required: true
            },
            address: String
        },

        contact_info: {
            name: String,
            phone: String,
            email: String
        },

        views: { type: Number, default: 0 },
        isDeleted: { type: Boolean, default: false }
    },
    { timestamps: true }
);

// QUAN TRỌNG: Index 2dsphere cho trường location
communityPostSchema.index({ location: "2dsphere" });
communityPostSchema.index({ "ai_metadata.breed": "text" });

const CommunityPost = mongoose.model<CommunityPostDoc>("CommunityPost", communityPostSchema);
export { CommunityPost };
