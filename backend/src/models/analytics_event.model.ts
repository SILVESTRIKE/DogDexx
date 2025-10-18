import mongoose, { Schema, Document } from "mongoose";

export enum AnalyticsEventName {
  // User Authentication
  USER_REGISTRATION = "USER_REGISTRATION",
  USER_LOGIN = "USER_LOGIN",

  // Core Feature Usage
  SUCCESSFUL_PREDICTION = "SUCCESSFUL_PREDICTION",
  SUCCESSFUL_PREDICTION_BATCH = "SUCCESSFUL_PREDICTION_BATCH",
  SUCCESSFUL_PREDICTION_VIEW = "SUCCESSFUL_PREDICTION_VIEW",
  SUCCESSFUL_PREDICTION_STREAM = "SUCCESSFUL_PREDICTION_STREAM",

  // General
  PAGE_VISIT = "PAGE_VISIT",
}

export interface AnalyticsEventDoc extends Document {
  eventName: AnalyticsEventName;
  fingerprint?: string;
  user?: mongoose.Types.ObjectId; // Add user field for tracking logged-in users
  ip?: string;
  userAgent?: string;
  eventData?: mongoose.Schema.Types.Mixed;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const analyticsEventSchema = new Schema(
  {
    eventName: {
      type: String,
      required: true,
      enum: Object.values(AnalyticsEventName),
    },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    eventData: { type: Schema.Types.Mixed },
    fingerprint: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    isDeleted: {
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
