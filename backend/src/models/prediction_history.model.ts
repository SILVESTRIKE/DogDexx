import mongoose, { Schema, Document, Types } from "mongoose";
import { MediaDoc } from "./medias.model";
import { UserDoc } from "./user.model";

// =================================================================
// ĐỊNH NGHĨA IYoloPrediction NẰM Ở ĐÂY
// =================================================================
/**
 * Định nghĩa cấu trúc cho một đối tượng dự đoán duy nhất trả về từ AI Service.
 */
export interface IYoloPrediction {
  track_id?: number;
  box: number[];
  class: string;
  confidence: number;
  class_id?: number; // Thêm class_id để có thể dùng sau này nếu cần
}
// =================================================================

export type PredictionHistoryDoc = Document & {
  user?: UserDoc;
  media: MediaDoc;
  mediaPath: string; // Đường dẫn của file media gốc
  modelUsed: string;
  source: 'image_upload' | 'video_upload' | 'stream_capture';
  predictions: IYoloPrediction[];
  processedMediaPath?: string; // Đường dẫn của file media đã được xử lý (có vẽ bounding box)
  isCorrect: boolean | null;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  feedback?: Types.ObjectId; // Thêm trường ảo để populate
};

const predictionHistorySchema = new Schema<PredictionHistoryDoc>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false, // Cho phép guest (khách)
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
      enum: ['image_upload', 'video_upload', 'stream_capture'],
      required: true,
    },
    predictions: [
      {
        _id: false, // Không tạo _id cho các sub-document trong mảng
        track_id: { type: Number, required: false },
        box: { type: [Number], required: true },
        class: { type: String, required: true },
        confidence: { type: Number, required: true },
        class_id: { type: Number, required: false },
      },
    ],
    processedMediaPath: { type: String, required: false },
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

// --- VIRTUALS ---
// Thêm một trường ảo 'feedback' để tạo mối quan hệ hai chiều với FeedbackModel
// Điều này cho phép chúng ta populate('feedback') trên một PredictionHistory.
predictionHistorySchema.virtual('feedback', {
  ref: 'Feedback', // Model để tham chiếu
  localField: '_id', // Trường trên model này (PredictionHistory)
  foreignField: 'prediction_id', // Trường trên model kia (Feedback)
  justOne: true, // Chỉ tìm một bản ghi feedback duy nhất cho mỗi prediction
});

export const PredictionHistoryModel = mongoose.model<PredictionHistoryDoc>(
  "PredictionHistory",
  predictionHistorySchema
);