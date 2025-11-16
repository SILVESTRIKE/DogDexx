import mongoose, { Schema, Document, Types } from "mongoose";

export type ModelTaskType =
  | "DOG_BREED_CLASSIFICATION"
  | "CAT_BREED_CLASSIFICATION"
  | "OBJECT_DETECTION";
export type ModelFormatType = "ONNX" | "TENSORFLOW_JS" | "PYTORCH";
export type ModelStatusType = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export type AIModelDoc = Document & {
  name: string;
  description: string;
  taskType: ModelTaskType;
  format: ModelFormatType;
  huggingFaceRepo: string;
  fileName: string;
  path: string; // THÊM
  labelsFileName: string; // THÊM
  version: string;
  status: ModelStatusType;
  tags: string[];
  creator_id: Types.ObjectId;
  isDeleted: boolean;
};

const aiModelSchema = new Schema<AIModelDoc>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    taskType: {
      type: String,
      enum: [
        "DOG_BREED_CLASSIFICATION",
        "CAT_BREED_CLASSIFICATION",
        "OBJECT_DETECTION",
      ],
      required: true,
      index: true,
    },
    format: {
      type: String,
      enum: ["ONNX", "TENSORFLOW_JS", "PYTORCH"],
      required: true,
    },
    huggingFaceRepo: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    path: { type: String, required: true, trim: true },
    labelsFileName: { type: String, required: true, default: "labels.json" }, // THÊM
    version: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
      default: "INACTIVE",
      index: true,
    },
    tags: [{ type: String }],
    creator_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "ai_models",
    toJSON: {
      transform: (doc: any, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

export const AIModel = mongoose.model<AIModelDoc>("AIModel", aiModelSchema);
