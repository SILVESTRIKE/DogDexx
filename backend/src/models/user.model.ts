import mongoose, { Document, Schema, Types } from "mongoose";
import { DirectoryDoc } from "./directory.model";
export type UserRole = "user" | "premium" | "admin";

export type UserDoc = Document & {
  // TK
  username: string;
  email: string;
  password: string;
  role: UserRole;

  // Thông tin cá nhân
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;

  //bao Mat
  verify: boolean;
  isDeleted: boolean;

  directory_id: Types.ObjectId;

  //gioi han
  photoUploadsThisWeek: number;
  videoUploadsThisWeek: number;
  lastUsageResetAt: Date;

  //timestamp
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserDoc>(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "premium", "admin"],
      default: "user",
      required: true,
    },

    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
    
    directory_id: {
      type: Schema.Types.ObjectId,
      ref: "Directory",
    },
    verify: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },

    photoUploadsThisWeek: {
      type: Number,
      default: 0,
    },
    videoUploadsThisWeek: {
      type: Number,
      default: 0,
    },
    lastUsageResetAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "users",
    toJSON: {
      transform: (doc: any, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.isDeleted;
      },
    },
    toObject: {
      virtuals: true,
      transform(doc: any, ret: any) {
        ret.id = ret._id.toString();
        if (ret.directory_id instanceof Types.ObjectId) {
          ret.directory_id = ret.directory_id.toString();
        }
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.isDeleted;
      },
    },
  }
);

export const UserModel = mongoose.model<UserDoc>("User", userSchema);
