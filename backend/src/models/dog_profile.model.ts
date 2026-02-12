import mongoose, { Schema, Document } from "mongoose";

export interface DogProfileDoc extends Document {
    owner_id: string;
    name: string;
    breed: string;
    birthday?: Date;
    gender: "male" | "female";
    avatarPath?: string;
    photos: string[];

    sterilized: boolean;

    isLost: boolean;
    lastSeenLocation?: {
        lat: number;
        lng: number;
        address: string;
    };
    lostAt?: Date;

    attributes: {
        color?: string;
        pattern?: string;
        size?: string;
    };
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const dogProfileSchema = new Schema(
    {
        owner_id: { type: String, required: true, index: true },
        name: { type: String, required: true },
        breed: { type: String, required: true, index: true },
        birthday: { type: Date },
        gender: { type: String, enum: ["male", "female"], required: true },
        avatarPath: { type: String },
        photos: [{ type: String }],
        sterilized: { type: Boolean, default: false },

        attributes: {
            color: { type: String, index: true },
            pattern: String,
            size: String,
        },

        isLost: { type: Boolean, default: false, index: true },
        lastSeenLocation: {
            lat: Number,
            lng: Number,
            address: String,
        },
        lostAt: Date,
        isDeleted: { type: Boolean, default: false, select: false },
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc: any, ret: any) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                delete ret.isDeleted;
            },
        },
    }
);

const DogProfile = mongoose.model<DogProfileDoc>("DogProfile", dogProfileSchema);
export { DogProfile };
