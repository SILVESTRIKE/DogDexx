// src/models/ai_models.model.ts

import mongoose, { Schema, Document, Types } from "mongoose";
import { IConfiguration } from "./config.model";

export type ModelTaskType =
  | "DOG_BREED_CLASSIFICATION"
  | "CAT_BREED_CLASSIFICATION"
  | "OBJECT_DETECTION";
export type ModelFormatType = "ONNX" | "PYTORCH";
export type ModelStatusType = "ACTIVE" | "INACTIVE";

/**
 * AIModelDoc: Đóng vai trò là một "catalog" chứa thông tin nhận dạng của model.
 */
export type AIModelDoc = Document & {
  name: string;
  description: string;
  taskType: ModelTaskType;
  format: ModelFormatType;
  huggingFaceRepo: string;
  fileName: string;
  path: string;
  version: string;
  status: ModelStatusType;
  creator_id: Types.ObjectId;
  isDeleted: boolean;
  configId: Types.ObjectId | IConfiguration;
};

const aiModelSchema = new Schema<AIModelDoc>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    taskType: { type: String, enum: ["DOG_BREED_CLASSIFICATION", "CAT_BREED_CLASSIFICATION", "OBJECT_DETECTION"], required: true, index: true },
    format: { type: String, enum: ["ONNX", "PYTORCH"], required: true },
    huggingFaceRepo: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    path: { type: String, required: true, trim: true },
    version: { type: String, required: true, trim: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "INACTIVE", index: true },
    creator_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isDeleted: { type: Boolean, default: false },
    configId: { type: Schema.Types.ObjectId, ref: 'Configuration', default: null }
  },
  {
    timestamps: true,
    collection: "ai_models",
    toJSON: {
      transform: (doc: any, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

export const AIModel = mongoose.model<AIModelDoc>("AIModel", aiModelSchema);