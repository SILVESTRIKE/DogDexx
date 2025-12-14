import mongoose, { Schema, Document } from "mongoose";

export interface DogProfileDoc extends Document {
    owner_id: string;
    name: string;
    breed: string;
    birthday?: Date;
    gender: "male" | "female";
    avatarPath?: string;
    photos: string[];

    // Removed isLost, lastSeenLocation, lostAt -> Moved to CommunityPost (Type: LOST)

    attributes: {
        color?: string;
        pattern?: string;
        size?: string;
    };
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

        attributes: {
            color: { type: String, index: true },
            pattern: String,
            size: String,
        },
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

const DogProfile = mongoose.model<DogProfileDoc>("DogProfile", dogProfileSchema);
export { DogProfile };
