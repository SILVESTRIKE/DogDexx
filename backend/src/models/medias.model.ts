import mongoose, { Schema, Document, Types } from "mongoose";
import { DirectoryDoc } from "./directory.model";

export type MediaDoc = mongoose.Document & {
  _id: mongoose.Types.ObjectId;
  name: string;
  mediaPath: string;
  description: string | null;
  type: string | null;
  creator_id?: mongoose.Types.ObjectId;
  directory_id?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
};

const mediaSchema = new mongoose.Schema<MediaDoc>(
  {
    name: {
      type: String,
      required: [true, "Tên media là bắt buộc"],
    },
    mediaPath: {
      type: String,
      required: [true, "Đường dẫn media là bắt buộc"],
    },
    description: { type: String, default: null },
    type: { type: String, default: null },
    creator_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    directory_id: {
      type: Schema.Types.ObjectId,
      ref: "Directory",
      required: false,
      index: true,
    },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "medias",
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
      transform(doc: any, ret: any) {
        ret.id = ret._id.toString();
        delete ret._id;
        if (ret.creator_id instanceof Types.ObjectId) {
          ret.creator_id = ret.creator_id.toString();
        }
        if (ret.directory_id instanceof Types.ObjectId) {
          ret.directory_id = ret.directory_id.toString();
        }
        delete ret.__v;
        delete ret.isDeleted;
      },
    },
  }
);
mediaSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 604800, // 7 ngày = 604800 giây
    partialFilterExpression: { creator_id: { $eq: null } },
  }
);

export const MediaModel = mongoose.model<MediaDoc>("Media", mediaSchema);
