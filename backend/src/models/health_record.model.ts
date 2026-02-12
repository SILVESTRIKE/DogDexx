import mongoose, { Schema, Document } from "mongoose";

export interface HealthRecordDoc extends Document {
    dog_id: string;
    type: "vaccine" | "checkup" | "medicine" | "surgery" | "hygiene" | "other";
    title: string;
    date: Date;
    nextDueDate?: Date;
    reminderSent?: boolean;
    notes?: string;

    // New Fields
    vetName?: string;
    cost?: number;
    weight?: number; // kg
    symptoms?: string;
    diagnosis?: string;

    attachments: string[]; // URLs
    createdAt: Date;
    updatedAt: Date;
}

const healthRecordSchema = new Schema(
    {
        dog_id: { type: Schema.Types.ObjectId, ref: "DogProfile", required: true, index: true },
        type: {
            type: String,
            enum: ["vaccine", "checkup", "medicine", "surgery", "hygiene", "other"],
            required: true,
        },
        title: { type: String, required: true },
        date: { type: Date, required: true },
        nextDueDate: { type: Date },
        reminderSent: { type: Boolean, default: false },
        notes: { type: String },

        vetName: { type: String },
        cost: { type: Number, min: 0 },
        weight: { type: Number, min: 0 },
        symptoms: { type: String },
        diagnosis: { type: String },

        attachments: [{ type: String }],
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

const HealthRecord = mongoose.model<HealthRecordDoc>("HealthRecord", healthRecordSchema);
export { HealthRecord };
