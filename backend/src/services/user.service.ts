import bcrypt from "bcryptjs";
import {
  UserModel,
  UserDoc,
  UserRole,
  UnlockedAchievement,
} from "../models/user.model";
import { OtpModel, OtpType } from "../models/otp.model";
import { emailService } from "./email.service";
import { RegisterType } from "../types/zod/user.zod";
import mongoose, { Types } from "mongoose";
import { BadRequestError, ConflictError, NotFoundError } from "../errors";
import { DirectoryModel } from "../models/directory.model";
import { MediaModel } from "../models/medias.model";
import { PredictionHistoryModel } from "../models/prediction_history.model";
import { FeedbackModel } from "../models/feedback.model";
import { PlanModel } from "../models/plan.model";
import { logger } from "../utils/logger.util"
import { uploadToCloudinary } from "../utils/media.util";
// Định nghĩa kiểu dữ liệu cho user đã được làm giàu
export type EnrichedUser = UserDoc & { tokenAllotment: number };

/**
 * @private
 * Hàm helper nội bộ để làm giàu dữ liệu user với thông tin từ PlanModel.
 * @param user - Đối tượng user (plain object hoặc Mongoose document)
 * @returns Đối tượng user đã được làm giàu hoặc null.
 */
async function _enrich(user: UserDoc | null): Promise<EnrichedUser | null> {
  if (!user) return null;
  const userPlan = await PlanModel.findOne({ slug: user.plan }).lean();
  const userObject = user.toObject ? user.toObject() : user;
  return {
    ...userObject,
    tokenAllotment: userPlan?.tokenAllotment || 0,
  };
}

export const userService = {
  async getAll(
    options: { page?: number; limit?: number; search?: string } = {}
  ): Promise<{
    data: (EnrichedUser | null)[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, search } = options;
    const skip = (page - 1) * limit;
    const query: mongoose.FilterQuery<UserDoc> = { isDeleted: false };

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ username: searchRegex }, { email: searchRegex }];
    }

    const [users, total] = await Promise.all([
      UserModel.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      UserModel.countDocuments(query),
    ]);

    const enrichedUsers = await Promise.all(users.map((user) => _enrich(user)));

    return {
      data: enrichedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async getById(id: string): Promise<EnrichedUser> {
    const user = await UserModel.findOne({ _id: id, isDeleted: false }).select(
      "-password"
    );
    const enrichedUser = await _enrich(user);
    if (!enrichedUser)
      throw new NotFoundError(`Không tìm thấy người dùng với ID: ${id}`);
    return enrichedUser;
  },

  async getByEmail(
    email: string,
    selectPassword = false
  ): Promise<EnrichedUser & { password?: string }> {
    const query = UserModel.findOne({ email, isDeleted: false });
    const user = await (selectPassword ? query.select("+password") : query);
    const enrichedUser = await _enrich(user);
    if (!enrichedUser)
      throw new NotFoundError(`Không tìm thấy người dùng với email: ${email}`);
    return enrichedUser as EnrichedUser & { password?: string };
  },

  async createUser(data: RegisterType, avatarFile?: Express.Multer.File): Promise<EnrichedUser> {
    logger.info('[USER_SERVICE] Bắt đầu tạo user mới.');

    // 1. Kiểm tra Email và Username trong DB
    const existingUserByEmail = await UserModel.findOne({ email: data.email });
    const existingUserByUsername = await UserModel.findOne({ username: data.username });

    // 2. Lấy Free Plan để gán mặc định
    const freePlan = await PlanModel.findOne({ slug: 'free' }).lean();
    if (!freePlan) throw new Error("Lỗi hệ thống: Không tìm thấy gói cước mặc định.");

    // === TRƯỜNG HỢP 1: EMAIL ĐÃ TỒN TẠI ===
    if (existingUserByEmail) {
      // A. Nếu đã xác thực -> Báo lỗi chuẩn
      if (existingUserByEmail.verify) {
        throw new BadRequestError("Email này đã được đăng ký.");
      }

      // B. Nếu CHƯA xác thực -> Đây là "Zombie Account" -> GHI ĐÈ
      logger.info(`[USER_SERVICE] Phát hiện tài khoản chưa xác thực: ${data.email}. Tiến hành ghi đè.`);

      // Kiểm tra Username mới có trùng với người KHÁC không
      if (existingUserByUsername && existingUserByUsername._id.toString() !== existingUserByEmail._id.toString()) {
        throw new BadRequestError("Tên người dùng này đã được sử dụng bởi người khác.");
      }

      // Hash mật khẩu mới
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Cập nhật thông tin mới vào document cũ
      existingUserByEmail.username = data.username;
      existingUserByEmail.password = hashedPassword;
      existingUserByEmail.firstName = data.firstName;
      existingUserByEmail.lastName = data.lastName;

      if ((data as any).country) existingUserByEmail.country = (data as any).country;
      if ((data as any).city) existingUserByEmail.city = (data as any).city;
      if ((data as any).phoneNumber) existingUserByEmail.phoneNumber = (data as any).phoneNumber;

      if (avatarFile) {
        if (existingUserByEmail.avatarPath) {
          await MediaModel.updateOne({ mediaPath: existingUserByEmail.avatarPath }, { isDeleted: true });
        }

        let mediaPath = '';
        if (avatarFile.buffer) {
          const result = await uploadToCloudinary(avatarFile.buffer, 'public/uploads/avatars');
          mediaPath = `${result.public_id}.${result.format}`;
        } else {
          mediaPath = (avatarFile as any).path || avatarFile.path.replace(/\\/g, '/');
        }

        const avatarMedia = new MediaModel({
          name: `avatar-${existingUserByEmail.username}-${Date.now()}`,
          mediaPath: mediaPath,
          creator_id: existingUserByEmail._id,
          type: 'image/avatar',
        });
        await avatarMedia.save();
        existingUserByEmail.avatarPath = avatarMedia.mediaPath;
      }

      await existingUserByEmail.save();

      // Gửi lại OTP mới
      await this.sendOtp(existingUserByEmail.email);

      const enriched = await _enrich(existingUserByEmail);
      delete (enriched as any).password;
      return enriched!;
    }

    // === TRƯỜNG HỢP 2: TẠO MỚI HOÀN TOÀN ===
    if (existingUserByUsername) {
      throw new BadRequestError("Tên người dùng đã tồn tại.");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = new UserModel({
      ...data,
      password: hashedPassword,
      plan: 'free',
      remainingTokens: freePlan.tokenAllotment,
    });

    if (avatarFile) {
      let mediaPath = '';
      if (avatarFile.buffer) {
        const result = await uploadToCloudinary(avatarFile.buffer, 'public/uploads/avatars');
        mediaPath = `${result.public_id}.${result.format}`;
      } else {
        mediaPath = (avatarFile as any).path || avatarFile.path.replace(/\\/g, '/');
      }

      const avatarMedia = new MediaModel({
        name: `avatar-${user.username}`,
        mediaPath: mediaPath,
        creator_id: user._id,
        type: 'image/avatar',
      });
      await avatarMedia.save();
      user.avatarPath = avatarMedia.mediaPath;
    }

    await user.save();

    const directory = new DirectoryModel({ name: user.username, creator_id: user._id });
    await directory.save();
    user.directory_id = directory._id as any;
    await user.save();
    await this.sendOtp(user.email);

    const enrichedUser = await _enrich(user);
    delete (enrichedUser as any).password;
    return enrichedUser!;
  },


  async updateUser(
    id: string,
    data: Partial<UserDoc> | { [key: string]: any },
    avatarFile?: Express.Multer.File
  ): Promise<EnrichedUser> {
    if (avatarFile) {
      const user = await UserModel.findById(id);
      if (!user) throw new NotFoundError("Không tìm thấy người dùng.");
      if (user.avatarPath) {
        await MediaModel.findOneAndUpdate(
          { mediaPath: user.avatarPath },
          { isDeleted: true }
        );
      }

      let mediaPath = '';
      if (avatarFile.buffer) {
        const result = await uploadToCloudinary(avatarFile.buffer, 'public/uploads/avatars');
        mediaPath = `${result.public_id}.${result.format}`;
      } else {
        mediaPath = (avatarFile as any).path || avatarFile.path.replace(/\\/g, '/');
      }

      (data as Partial<UserDoc>).avatarPath = mediaPath;
    }

    if ((data as Partial<UserDoc>).password) {
      (data as Partial<UserDoc>).password = await bcrypt.hash(
        (data as Partial<UserDoc>).password!,
        10
      );
    }

    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      data,
      { new: true, runValidators: true }
    ).select("-password");

    const enrichedUser = await _enrich(updatedUser);
    if (!enrichedUser)
      throw new NotFoundError(
        `Cập nhật thất bại, không tìm thấy người dùng với ID: ${id}.`
      );
    return enrichedUser;
  },

  async updateAvatar(
    userId: string,
    avatarFile: Express.Multer.File
  ): Promise<EnrichedUser> {
    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("Không tìm thấy người dùng.");

    if (user.avatarPath) {
      await MediaModel.findOneAndUpdate(
        { mediaPath: user.avatarPath },
        { isDeleted: true }
      );
    }

    let mediaPath = '';
    if (avatarFile.buffer) {
      const result = await uploadToCloudinary(avatarFile.buffer, 'public/uploads/avatars');
      mediaPath = `${result.public_id}.${result.format}`;
    } else {
      mediaPath = (avatarFile as any).path || avatarFile.path.replace(/\\/g, '/');
    }

    const newAvatarMedia = new MediaModel({
      name: `avatar-${user.username}-${Date.now()}`,
      mediaPath: mediaPath,
      creator_id: user._id,
      type: "image/avatar",
    });
    await newAvatarMedia.save();

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      { avatarPath: newAvatarMedia.mediaPath },
      { new: true }
    ).select("-password");

    if (!updatedUser)
      throw new NotFoundError(
        "Lỗi khi lấy thông tin người dùng sau khi cập nhật avatar."
      );
    return (await _enrich(updatedUser))!;
  },

  async sendOtp(email: string): Promise<{ message: string }> {
    logger.info(`[USER_SERVICE] Bắt đầu sendOtp cho email: ${email}`);

    const user = await UserModel.findOne({ email });
    if (!user) {
      throw new NotFoundError("Không tìm thấy người dùng để gửi OTP");
    }
    if (user.verify) {
      throw new BadRequestError("Tài khoản này đã được xác thực rồi.");
    }

    logger.info(
      `[USER_SERVICE] sendOtp: Người dùng hợp lệ. Bắt đầu tạo và lưu OTP.`
    );
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await OtpModel.deleteMany({
      email: email,
      type: OtpType.EMAIL_VERIFICATION,
    });
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const otpPayload = {
      email,
      otp: otpCode,
      type: OtpType.EMAIL_VERIFICATION,
      expiresAt,
    };
    await new OtpModel(otpPayload).save();

    logger.info(`[USER_SERVICE] sendOtp: Đã lưu OTP. Chuẩn bị gửi email...`);

    try {
      await emailService.sendEmail(
        user.email,
        "OTP Verification",
        `Your OTP code is: ${otpCode}`
      );
      logger.info(`[USER_SERVICE] sendOtp: Gửi email thành công đến ${email}.`);
      return { message: "OTP đã được gửi đến email của bạn" };
    } catch (error) {
      logger.error("[FATAL] Lỗi không thể gửi email xác thực:", error);
      throw new Error(
        "Hệ thống không thể gửi email xác thực tại thời điểm này. Vui lòng thử lại sau."
      );
    }
  },

  async deleteUser(id: string): Promise<boolean> {
    const user = await UserModel.findOne({ _id: id, isDeleted: false });
    if (!user) throw new ConflictError("Không tìm thấy người dùng để xóa.");

    await UserModel.updateOne({ _id: id }, { $set: { isDeleted: true } });

    await Promise.all([
      MediaModel.updateMany(
        { creator_id: user._id },
        { $set: { isDeleted: true } }
      ),
      DirectoryModel.updateMany(
        { creator_id: user._id },
        { $set: { isDeleted: true } }
      ),
      PredictionHistoryModel.updateMany(
        { user: user._id },
        { $set: { isDeleted: true } }
      ),
      FeedbackModel.updateMany(
        { user_id: user._id },
        { $set: { isDeleted: true } }
      ),
    ]);

    if (user.email) {
      await OtpModel.deleteMany({ email: user.email });
    }

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

  async updateUserById(
    userId: string,
    updateData: Partial<Pick<UserDoc, "username" | "email" | "role" | "verify">>
  ): Promise<EnrichedUser> {
    const user = await UserModel.findById(userId);
    if (!user || user.isDeleted)
      throw new NotFoundError("Không tìm thấy người dùng.");
    return this.updateUser(userId, updateData);
  },

  async createUserByAdmin(data: {
    username: string;
    email: string;
    password: string;
    role: UserRole;
    verify?: boolean;
  }): Promise<UserDoc> {
    const { username, email, password, role, verify = true } = data;
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) throw new ConflictError("Email đã được sử dụng.");

    const userPlan = await PlanModel.findOne({ slug: "free" }).lean();

    const newDirectory = await DirectoryModel.create({
      name: `${username}'s Directory`,
      creator_id: new mongoose.Types.ObjectId(),
    });
    const user = new UserModel({
      username,
      email,
      password,
      role,
      directory_id: newDirectory._id,
      verify: verify,
      plan: "free",
      remainingTokens: userPlan?.tokenAllotment || 10,
    });
    await user.save();
    newDirectory.creator_id = user._id as mongoose.Types.ObjectId;
    await newDirectory.save();
    const plainUserResult = user.toObject();
    delete (plainUserResult as any).password;
    return plainUserResult as UserDoc;
  },
};
