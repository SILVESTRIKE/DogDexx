import bcrypt from "bcryptjs";
import { UserModel, UserDoc, UserRole } from "../models/user.model";
import { OtpModel, OtpType } from "../models/otp.model";
import { sendEmail } from "./email.service";
import { RegisterType } from "../types/zod/user.zod";
import mongoose, { Types, ClientSession } from "mongoose";
import { BadRequestError, ConflictError } from "../errors";
import { DirectoryModel } from "../models/directory.model";

export type PlainUser = {
  _id: Types.ObjectId;
  username: string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  verify: boolean;
  isGuest?: boolean;
  photoUploadsThisWeek: number;
  videoUploadsThisWeek: number;
  lastUsageResetAt: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const userService = {
  async getAll(options: { page?: number, limit?: number, search?: string } = {}): Promise<{ data: PlainUser[], total: number, page: number, limit: number, totalPages: number }> {
    const { page = 1, limit = 10, search } = options;
    const skip = (page - 1) * limit;
    const query: mongoose.FilterQuery<UserDoc> = { isDeleted: false };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { username: searchRegex },
        { email: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
      ];
    }

    const [users, total] = await Promise.all([
      UserModel.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      UserModel.countDocuments(query)
    ]);

    return {
      data: users as PlainUser[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  async getById(id: string): Promise<PlainUser | null> {
    return UserModel.findOne({ _id: id, isDeleted: false }).select("-password");
  },

  async getByEmail(
    email: string,
    selectPassword = false
  ): Promise<(UserDoc & { password?: string }) | null> {
    const query = UserModel.findOne({ email, isDeleted: false });
    return selectPassword ? query.select("+password") : query;
  },

  async createUser(data: RegisterType): Promise<PlainUser> {
    try {
      const existed = await UserModel.findOne({ email: data.email });
      if (existed) {
        throw new BadRequestError("Email đã tồn tại.");
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);

      const user = new UserModel({ ...data, password: hashedPassword });
      await user.save();

      // Create a directory for the user
      const directory = new DirectoryModel({
        name: user.username,
        creator_id: user._id,
      });
      await directory.save();

      // Update the user with the directoryId
      user.directory_id = directory._id;
      await user.save();

      await this.sendOtp(user.email);

      const { password, ...plainUserResult } = user.toObject();
      return plainUserResult as PlainUser;
    } catch (error) {
      throw error;
    }
  },

  // Sửa lại hàm sendOtp để không nhận session
  async sendOtp(email: string): Promise<{ message: string }> {
    const user = await UserModel.findOne({ email });
    if (!user) throw new ConflictError("Không tìm thấy người dùng");
    if (user.verify)
      throw new BadRequestError("Tài khoản này đã được xác thực rồi.");

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await OtpModel.deleteMany({
      email: email,
      type: OtpType.EMAIL_VERIFICATION,
    });

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await new OtpModel({
      email: email,
      otp: otpCode,
      type: OtpType.EMAIL_VERIFICATION,
      expiresAt: expiresAt,
    }).save();

    await sendEmail(
      user.email,
      "OTP Verification",
      `Your OTP code is: ${otpCode}`
    );
    return { message: "OTP đã được gửi đến email của bạn" };
  },

  async updateUser(
    id: string,
    data: Partial<UserDoc>
  ): Promise<UserDoc | null> { // <-- Sửa lại kiểu trả về thành UserDoc
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      data,
      { new: true, runValidators: true }
    )
      .select("-password");
      
    if (!updatedUser)
      throw new ConflictError("Cập nhật thất bại, không tìm thấy người dùng.");
    return updatedUser;
  },

  async deleteUser(id: string): Promise<boolean> {
    const result = await UserModel.updateOne(
      { _id: id, isDeleted: false },
      { isDeleted: true }
    );
    if (result.modifiedCount === 0)
      throw new ConflictError("Không tìm thấy người dùng để xóa.");
    return true;
  },

  async verifyOtp(email: string, otp: string): Promise<boolean> {
    const user = await UserModel.findOne({ email });
    if (!user) throw new Error("Email không hợp lệ");

    const otpRecord = await OtpModel.findOne({ email: email, otp: otp });
    if (!otpRecord)
      throw new BadRequestError("OTP không hợp lệ hoặc đã hết hạn");
    await UserModel.findByIdAndUpdate(user._id, { verify: true });
    await OtpModel.deleteOne({ _id: otpRecord._id });
    return true;
  },
};
