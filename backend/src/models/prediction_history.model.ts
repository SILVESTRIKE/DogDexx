import mongoose, { Schema, Document, Types } from "mongoose";
import { MediaDoc } from "./medias.model";
import { UserDoc } from "./user.model";

export interface IYoloPrediction {
  track_id?: number;
  box: number[];
  class: string;
  confidence: number;
  class_id?: number;
}

export interface StreamResultPayload {
  processed_media_base64: string;
  detections: IYoloPrediction[];
}

export type PredictionHistoryDoc = Document & {
  user?: UserDoc;
  media: MediaDoc;
  mediaPath: string;
  modelUsed: string;
  source: 'image_upload' | 'video_upload' | 'stream_capture' | 'url_input';
  predictions: IYoloPrediction[];
  processedMediaPath?: string;
  processingTime?: number;
  isCorrect: boolean | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  feedback?: Types.ObjectId;
};

const predictionHistorySchema = new Schema<PredictionHistoryDoc>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    media: {
      type: Schema.Types.ObjectId,
      ref: "Media",
      required: true,
      index: true,
    },
    mediaPath: { type: String, required: true },
    modelUsed: { type: String, required: true },
    source: {
      type: String,
      enum: ['image_upload', 'video_upload', 'stream_capture', 'url_input'],
      required: true,
    },
    predictions: [
      {
        _id: false,
        track_id: { type: Number, required: false },
        box: { type: [Number], required: true },
        class: { type: String, required: true },
        confidence: { type: Number, required: true },
        class_id: { type: Number, required: false },
      },
    ],
    processedMediaPath: { type: String, required: false },
    processingTime: { type: Number, required: false },
    isCorrect: { type: Boolean, default: null },
    isDeleted: { type: Boolean, default: false, index: true, select: false },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "prediction_histories",
    toJSON: {
      transform: (doc: any, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.isDeleted;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc: any, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.isDeleted;
      },
    },
  }
);
predictionHistorySchema.virtual('feedback', {
  ref: 'Feedback',
  localField: '_id',
  foreignField: 'prediction_id',
  justOne: true,
});

export const PredictionHistoryModel = mongoose.model<PredictionHistoryDoc>(
  "PredictionHistory",
  predictionHistorySchema
);