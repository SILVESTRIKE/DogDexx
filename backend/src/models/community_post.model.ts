import mongoose, { Schema, Document } from "mongoose";

export enum PostType {
    LOST = "LOST",
    FOUND = "FOUND",
    SALE = "SALE",
    ADOPTION = "ADOPTION",
    GENERAL = "GENERAL"
}

export enum PostStatus {
    OPEN = "OPEN",
    RESOLVED = "RESOLVED",
    CLOSED = "CLOSED"
}

export interface CommunityPostDoc extends Document {
    author_id: string;
    type: PostType;
    status: PostStatus;

    title: string;
    content: string;
    photos: string[];

    dog_id?: string;

    tags: {
        breed?: string;
        color?: string;
        price?: number;
    };

    // --- NEW: AI Verification Field ---
    ai_verification?: {
        isVerified: boolean;      // True nếu AI đồng ý với User
        detectedBreed?: string;   // Giống mà AI nhìn thấy
        confidence?: number;      // Độ tự tin của AI
        checkedAt: Date;
    };
    // ----------------------------------

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

    views: number;
    createdAt: Date;
    updatedAt: Date;
}

const communityPostSchema = new Schema(
    {
        author_id: { type: String, required: true, index: true },
        type: {
            type: String,
            enum: Object.values(PostType),
            required: true,
            index: true
        },
        status: {
            type: String,
            enum: Object.values(PostStatus),
            default: PostStatus.OPEN,
            index: true
        },

        title: { type: String, required: true },
        content: { type: String },
        photos: [{ type: String }],

        dog_id: { type: Schema.Types.ObjectId, ref: "DogProfile", index: true },

        tags: {
            breed: { type: String, index: true },
            color: String,
            price: Number,
        },

        // --- NEW: AI Verification Schema ---
        ai_verification: {
            isVerified: Boolean,
            detectedBreed: String,
            confidence: Number,
            checkedAt: Date,
        },
        // -----------------------------------

        location: {
            lat: Number,
            lng: Number,
            address: String,
        },

        contact_info: {
            phone: String,
            email: String,
            facebook: String,
        },

        views: { type: Number, default: 0 },
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc: any, ret: any) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
            },
        },
    }
);

communityPostSchema.index({ title: "text", content: "text", "tags.breed": "text" });
communityPostSchema.index({ "location": "2dsphere" });

const CommunityPost = mongoose.model<CommunityPostDoc>("CommunityPost", communityPostSchema);
export { CommunityPost };
