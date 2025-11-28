import mongoose, { Schema, Document } from "mongoose";

export interface HealthRecordDoc extends Document {
    dog_id: string;
    type: "vaccine" | "checkup" | "medicine" | "surgery" | "other";
    title: string;
    date: Date;
    nextDueDate?: Date;
    notes?: string;
    vetName?: string;
    attachments: string[];
    createdAt: Date;
    updatedAt: Date;
}

const healthRecordSchema = new Schema(
    {
        dog_id: { type: Schema.Types.ObjectId, ref: "DogProfile", required: true, index: true },
        type: {
            type: String,
            enum: ["vaccine", "checkup", "medicine", "surgery", "other"],
            required: true,
        },
        title: { type: String, required: true },
        date: { type: Date, required: true },
        nextDueDate: { type: Date },
        notes: { type: String },
        vetName: { type: String },
        attachments: [{ type: String }],
    },
    {
        timestamps: true,
        toJSON: {
            transform(doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
            },
        },
    }
);

const HealthRecord = mongoose.model<HealthRecordDoc>("HealthRecord", healthRecordSchema);
export { HealthRecord };
