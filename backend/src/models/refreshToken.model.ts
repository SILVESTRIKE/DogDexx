import mongoose, { Document, Schema, Types } from "mongoose";
import { UserDoc } from "./user.model";

export type RefreshTokenDoc = Document & {
  user: Types.ObjectId | UserDoc;
  jti: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  isDeleted: boolean;
};

const refreshTokenSchema = new Schema<RefreshTokenDoc>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    jti: {
      type: String,
      required: true,
      unique: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "refresh_tokens",
    toJSON: {
      transform: (doc, ret: { [key: string]: any }) => {
        delete ret._id;
        delete ret.__v;
        delete ret.isDeleted;
        delete ret.token;
      }
    },
    toObject: {
      transform: (doc, ret: { [key: string]: any }) => {
        delete ret.token;
      }
    }
  }
);

refreshTokenSchema.index({ user: 1 });

export const RefreshTokenModel = mongoose.model<RefreshTokenDoc>(
  "RefreshToken",
  refreshTokenSchema
);
