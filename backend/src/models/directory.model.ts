import mongoose from "mongoose";

export type DirectoryDoc = mongoose.Document & {
  _id: mongoose.Types.ObjectId;
  name: string;
  parent_id: mongoose.Types.ObjectId | null;
  creator_id: mongoose.Types.ObjectId;
  isDeleted: boolean;
};

const directorySchema = new mongoose.Schema<DirectoryDoc>(
  {
    name: { type: String, required: [true, "Tên thư mục là bắt buộc"] },
    parent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Directory",
      default: null,
      index: true,
    },
    creator_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isDeleted: { type: Boolean, default: false, select: false },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "directories",
    toJSON: {
      virtuals: true,
      transform: (doc: any, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
      },
    },
    toObject: {
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.isDeleted;
      },
    },
  }
);

export const DirectoryModel = mongoose.model<DirectoryDoc>(
  "Directory",
  directorySchema
);
