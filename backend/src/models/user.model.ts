import mongoose, { Document, Schema, Types } from "mongoose";

export type UserRole = "user" | "de" | "admin";
export type Plan = "free" | "starter" | "professional" | "enterprise";

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

  // bao Mat
  verify: boolean;
  isDeleted: boolean;

  // Thư mục gốc của người dùng
  directory_id: Types.ObjectId;

  // THAY ĐỔI: Cơ chế giới hạn mới dựa trên token
  remainingTokens: number;
  lastUsageResetAt: Date;
  plan: Plan;

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
    verify: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false, select: false },

    // THAY ĐỔI: Thêm trường token
    remainingTokens: {
      type: Number,
      default: 10, // Mặc định 10 token "chào mừng" cho người dùng mới
      min: [0, "Số token không thể là số âm."], // THÊM DÒNG NÀY
    },
    lastUsageResetAt: { type: Date, default: () => new Date() },
    plan: {
      type: String,
      enum: ["free", "starter", "professional", "enterprise"],
      default: "free",
    },

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
