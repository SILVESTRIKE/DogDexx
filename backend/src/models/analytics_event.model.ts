import mongoose, { Schema, Document } from "mongoose";

export interface AnalyticsEventDoc extends Document {
  eventName: "SUCCESSFUL_TRIAL";
  fingerprint?: string;
  ip?: string;
  userAgent?: string;
  isDeleted: boolean; // <-- THÊM MỚI
  createdAt: Date;
  updatedAt: Date; // <-- THÊM MỚI
}

const analyticsEventSchema = new Schema(
  {
    eventName: {
      type: String,
      required: true,
      enum: ["SUCCESSFUL_TRIAL"],
    },
    fingerprint: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    isDeleted: {
      // <-- THÊM MỚI
      type: Boolean,
      default: false,
      select: false, // Ẩn trường này khỏi các câu query mặc định
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "analyticsevents",
    toJSON: {
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id.toString();

        delete ret.id;
        delete ret._id;
        delete ret.__v;
        delete ret.isDeleted;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 ngày = 7776000 giây

export const AnalyticsEventModel = mongoose.model<AnalyticsEventDoc>(
  "AnalyticsEvent",
  analyticsEventSchema
);
