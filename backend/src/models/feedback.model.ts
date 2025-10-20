import mongoose, { Schema, Document, Types } from "mongoose";

export interface FeedbackDoc extends Document {
  prediction_id: Types.ObjectId;
  user_id: Types.ObjectId;
  user_submitted_label?: string;
  notes?: string;
  status: "pending_review" | "approved_for_training" | "rejected";
  isDeleted: boolean; // <-- THÊM MỚI
  createdAt: Date;
  updatedAt: Date;
}

const feedbackSchema = new Schema<FeedbackDoc>(
  {
    prediction_id: {
      type: Schema.Types.ObjectId,
      ref: "PredictionHistory",
      required: true,
      unique: true,
    }, // Cho phép guest gửi feedback
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: false },
    user_submitted_label: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending_review", "approved_for_training", "rejected"],
      default: "pending_review",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "feedbacks",
    toJSON: {
      virtuals: true,
      transform(doc: any, ret: any) {
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

feedbackSchema.index({ user_submitted_label: 1, status: 1 });

export const FeedbackModel = mongoose.model<FeedbackDoc>(
  "Feedback",
  feedbackSchema
);
