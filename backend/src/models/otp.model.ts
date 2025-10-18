import mongoose, { Document, Schema, Types } from "mongoose";

export enum OtpType {
  EMAIL_VERIFICATION = "EMAIL_VERIFICATION",
  PASSWORD_RESET = "PASSWORD_RESET",
}

export type OtpDoc = Document & {
  _id: Types.ObjectId;
  email: string;
  otp: string;
  type: OtpType;
  expiresAt: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const otpSchema = new Schema<OtpDoc>(
  {
    email: {
      type: String,
      required: true,
    },
    otp: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(OtpType),
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: "otps",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    toJSON: {
      transform: (doc: any, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.otp;
        delete ret.isDeleted;
      },
    },
  }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpModel = mongoose.model<OtpDoc>("Otp", otpSchema);
