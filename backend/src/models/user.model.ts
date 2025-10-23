import mongoose, { Document, Schema, Types } from "mongoose";
export type UserRole = "user" | "de" | "admin";
export type Plan = "free" | "starter" | "professional" | "enterprise";
// Cấu trúc cho một thành tích đã mở khóa được nhúng vào User
export interface UnlockedAchievement {
  key: string;
  unlockedAt: Date;
}

export type UserDoc = Document & {
  // TK
  username: string;
  email: string;
  password: string;
  role: UserRole;

  // Thông tin cá nhân
  firstName?: string;
  lastName?: string;
  avatarPath?: string;

  //bao Mat
  verify: boolean;
  isDeleted: boolean;

  directory_id: Types.ObjectId;

  //gioi han
  photoUploadsThisWeek: number;
  videoUploadsThisWeek: number;
  lastUsageResetAt: Date;
  plan: Plan;
  storageUsedBytes: number;
  // Stripe-related fields
  stripeCustomerId?: string;
  subscriptionId?: string;

  // Thành tích đã mở khóa
  achievements: UnlockedAchievement[];

  //timestamp
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserDoc>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["user", "de", "admin"],
      default: "user",
      required: true,
    },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    avatarPath: { type: String, trim: true },
    directory_id: { type: Schema.Types.ObjectId, ref: "Directory" },
    verify: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false, select: false },
    photoUploadsThisWeek: { type: Number, default: 0 },
    videoUploadsThisWeek: { type: Number, default: 0 },
    lastUsageResetAt: { type: Date, default: () => new Date() },
    plan: { type: String, enum:["free", "starter", "professional", "enterprise"],default: "free" },
    storageUsedBytes: { type: Number, default: 0 },
    stripeCustomerId: { type: String, unique: true, sparse: true },
    subscriptionId: { type: String, unique: true, sparse: true },
    achievements: [
      {
        _id: false,
        key: { type: String, required: true },
        unlockedAt: { type: Date, required: true, default: Date.now },
      },
    ],
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
    collection: "users",
    toJSON: {
      virtuals: true,
      transform: (doc: any, ret: any) => {
        ret.id = ret._id.toString(); 
        ret._id = ret._id.toString(); 
        
        if (ret.directory_id) {
            ret.directory_id = ret.directory_id.toString();
        }
        
        delete ret.__v;
        delete ret.password;
        delete ret.isDeleted;
      },
    },
    toObject: {
      transform(doc: any, ret: any) {
        ret.id = ret._id.toString();
        ret._id = ret._id.toString();

        if (ret.directory_id) {
            ret.directory_id = ret.directory_id.toString();
        }

        delete ret.__v;
        delete ret.password;
        delete ret.isDeleted;
      },
    },
  }
);

export const UserModel = mongoose.model<UserDoc>("User", userSchema);
