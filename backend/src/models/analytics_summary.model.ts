import mongoose, { Schema, Document } from "mongoose";
import { AnalyticsEventName } from "../constants/analytics.constants";

export interface AnalyticsSummaryDoc extends Document {
  eventName: AnalyticsEventName;
  month: number;
  year: number;
  totalCount: number;
}

const analyticsSummarySchema = new Schema(
  {
    eventName: { type: String, required: true, enum: Object.values(AnalyticsEventName) },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    totalCount: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
    collection: "analyticssummaries",
  }
);

analyticsSummarySchema.index({ eventName: 1, year: 1, month: 1 }, { unique: true });

export const AnalyticsSummaryModel = mongoose.model<AnalyticsSummaryDoc>(
  "AnalyticsSummary",
  analyticsSummarySchema
);