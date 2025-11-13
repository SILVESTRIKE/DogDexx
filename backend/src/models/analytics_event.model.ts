import mongoose, { Schema, Document } from "mongoose";
import { AnalyticsEventName } from "../constants/analytics.constants";

export interface AnalyticsEventDoc extends Document {
  eventName: AnalyticsEventName;
  fingerprint?: string;
  user?: mongoose.Types.ObjectId;
  ip?: string;
  userAgent?: string;
  date: Date;
  count: number;
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
    // THAY ĐỔI: Date là bắt buộc
    date: { type: Date, required: true },
    // THAY ĐỔI: Đổi tên trường thành 'count'
    count: { type: Number, default: 1 },
    fingerprint: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
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

analyticsEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
analyticsEventSchema.index({ eventName: 1, date: 1, user: 1, fingerprint: 1 });

export const AnalyticsEventModel = mongoose.model<AnalyticsEventDoc>(
  "AnalyticsEvent",
  analyticsEventSchema
);