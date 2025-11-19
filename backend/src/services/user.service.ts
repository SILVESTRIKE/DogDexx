import bcrypt from "bcryptjs";
import { UserModel, UserDoc, UserRole, UnlockedAchievement } from "../models/user.model";
import { OtpModel, OtpType } from "../models/otp.model";
import { emailService } from "./email.service";
import { RegisterType } from "../types/zod/user.zod";
import mongoose, { Types } from "mongoose";
import { BadRequestError, ConflictError, NotFoundError } from "../errors";
import { DirectoryModel } from "../models/directory.model";
import { MediaModel } from "../models/medias.model";
import { PredictionHistoryModel } from '../models/prediction_history.model';
import { FeedbackModel } from '../models/feedback.model';
import { RefreshTokenModel } from '../models/refreshToken.model';
import { PlanModel } from "../models/plan.model";

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
  async getAll(options: { page?: number, limit?: number, search?: string } = {}): Promise<{ data: (EnrichedUser | null)[], total: number, page: number, limit: number, totalPages: number }> {
    const { page = 1, limit = 10, search } = options;
    const skip = (page - 1) * limit;
    const query: mongoose.FilterQuery<UserDoc> = { isDeleted: false };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [{ username: searchRegex }, { email: searchRegex }];
    }

    const [users, total] = await Promise.all([
      UserModel.find(query).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limit),
      UserModel.countDocuments(query)
    ]);
    
    const enrichedUsers = await Promise.all(users.map(user => _enrich(user)));

    return { data: enrichedUsers, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getById(id: string): Promise<EnrichedUser> {
    const user = await UserModel.findOne({ _id: id, isDeleted: false }).select("-password");
    const enrichedUser = await _enrich(user);
    if (!enrichedUser) throw new NotFoundError(`Không tìm thấy người dùng với ID: ${id}`);
    return enrichedUser;
  },

  async getByEmail(
    email: string,
    selectPassword = false
  ): Promise<EnrichedUser & { password?: string }> {
    const query = UserModel.findOne({ email, isDeleted: false });
    const user = await (selectPassword ? query.select("+password") : query);
    const enrichedUser = await _enrich(user);
    if (!enrichedUser) throw new NotFoundError(`Không tìm thấy người dùng với email: ${email}`);
    return enrichedUser as EnrichedUser & { password?: string };
  },

  async createUser(data: RegisterType, avatarFile?: Express.Multer.File): Promise<EnrichedUser> {
    console.log('[USER_SERVICE] Bắt đầu createUser cho email:', data.email);
    const [existedEmail, existedUsername, freePlan] = await Promise.all([
      UserModel.findOne({ email: data.email }),
      UserModel.findOne({ username: data.username }),
      PlanModel.findOne({ slug: 'free' }).lean(),
    ]);

    if (existedEmail) throw new BadRequestError("Email đã tồn tại.");
    if (existedUsername) throw new BadRequestError("Tên người dùng đã tồn tại.");
    if (!freePlan) throw new Error("Không tìm thấy gói 'free' mặc định trong hệ thống.");

    console.log('[USER_SERVICE] Kiểm tra email và username hợp lệ. Bắt đầu hash mật khẩu.');
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = new UserModel({
      ...data,
      password: hashedPassword,
      plan: 'free',
      remainingTokens: freePlan.tokenAllotment,
    });

    if (avatarFile) {
        console.log('[USER_SERVICE] Đang xử lý file avatar...');
        const avatarMedia = new MediaModel({
          name: `avatar-${user.username}`,
          mediaPath: avatarFile.path.replace(/\\/g, '/'),
          creator_id: user._id,
          type: 'image/avatar',
        });
        await avatarMedia.save();
        user.avatarPath = avatarMedia.mediaPath;
        console.log('[USER_SERVICE] Đã lưu avatar vào media. Path:', user.avatarPath);
    }
    
    console.log('[USER_SERVICE] Chuẩn bị lưu document người dùng...');
    await user.save(); // Lưu user để có _id
    console.log('[USER_SERVICE] Đã lưu người dùng với ID:', user._id);
    
    const directory = new DirectoryModel({ name: user.username, creator_id: user._id });
    await directory.save();
    console.log('[USER_SERVICE] Đã tạo thư mục cho người dùng.');

    await this.sendOtp(user.email); // Thêm await để đảm bảo gửi OTP xong mới trả về response
    
    console.log('[USER_SERVICE] createUser hoàn tất. Chuẩn bị làm giàu và trả về dữ liệu.');
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
        await MediaModel.findOneAndUpdate({ mediaPath: user.avatarPath }, { isDeleted: true });
      }
      (data as Partial<UserDoc>).avatarPath = avatarFile.path.replace(/\\/g, '/');
    }
    
    if ((data as Partial<UserDoc>).password) {
        (data as Partial<UserDoc>).password = await bcrypt.hash((data as Partial<UserDoc>).password!, 10);
    }

    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      data,
      { new: true, runValidators: true }
    ).select("-password");

    const enrichedUser = await _enrich(updatedUser);
    if (!enrichedUser) throw new NotFoundError(`Cập nhật thất bại, không tìm thấy người dùng với ID: ${id}.`);
    return enrichedUser;
  },

  async updateAvatar(userId: string, avatarFile: Express.Multer.File): Promise<EnrichedUser> {
    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("Không tìm thấy người dùng.");
    if (user.avatarPath) {
      await MediaModel.findOneAndUpdate({ mediaPath: user.avatarPath }, { isDeleted: true });
    }
    const newAvatarMedia = new MediaModel({
      name: `avatar-${user.username}-${Date.now()}`,
      mediaPath: avatarFile.path.replace(/\\/g, '/'),
      creator_id: user._id,
      type: 'image/avatar',
    });
    await newAvatarMedia.save();
    user.avatarPath = newAvatarMedia.mediaPath;
    await user.save();
    const updatedUser = await UserModel.findById(userId).select('-password');
    if (!updatedUser) throw new NotFoundError("Lỗi khi lấy thông tin người dùng sau khi cập nhật avatar.");
    return (await _enrich(updatedUser))!;
  },

  async sendOtp(email: string): Promise<{ message: string; }> {
    return new Promise(async (resolve, reject) => {
      console.log(`[USER_SERVICE] Bắt đầu sendOtp cho email: ${email}`);
      try {
        const user = await UserModel.findOne({ email });
        if (!user) {
          console.error(`[USER_SERVICE] sendOtp thất bại: Không tìm thấy người dùng với email ${email}`);
          return reject(new ConflictError("Không tìm thấy người dùng"));
        }
        if (user.verify) {
          console.warn(`[USER_SERVICE] sendOtp: Tài khoản ${email} đã được xác thực.`);
          return reject(new BadRequestError("Tài khoản này đã được xác thực rồi."));
        }
        console.log(`[USER_SERVICE] sendOtp: Tìm thấy người dùng, chưa xác thực. Bắt đầu tạo OTP.`);
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await OtpModel.deleteMany({ email: email, type: OtpType.EMAIL_VERIFICATION });

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const otpPayload = { email, otp: otpCode, type: OtpType.EMAIL_VERIFICATION, expiresAt };
        await new OtpModel(otpPayload).save();
        console.log(`[USER_SERVICE] sendOtp: Đã lưu OTP vào DB. Chuẩn bị gửi email.`);
        
        await emailService.sendEmail(user.email, "OTP Verification", `Your OTP code is: ${otpCode}`);
        console.log(`[USER_SERVICE] sendOtp: Gửi email thành công đến ${email}.`);
        resolve({ message: "OTP đã được gửi đến email của bạn" });
      } catch (error) {
        console.error(`[USER_SERVICE] Lỗi nghiêm trọng trong quá trình sendOtp cho ${email}:`, error);
        reject(error);
      }
    });
  },

  async deleteUser(id: string): Promise<boolean> {
    const user = await UserModel.findOne({ _id: id, isDeleted: false });
    if (!user) throw new ConflictError("Không tìm thấy người dùng để xóa.");

    // Soft-delete the user
    await UserModel.updateOne({ _id: id }, { $set: { isDeleted: true } });

    // Soft-delete related resources to avoid orphaned documents
    await Promise.all([
      MediaModel.updateMany({ creator_id: user._id }, { $set: { isDeleted: true } }),
      DirectoryModel.updateMany({ creator_id: user._id }, { $set: { isDeleted: true } }),
      PredictionHistoryModel.updateMany({ user: user._id }, { $set: { isDeleted: true } }),
      FeedbackModel.updateMany({ user_id: user._id }, { $set: { isDeleted: true } }),
      RefreshTokenModel.updateMany({ user: user._id }, { $set: { isDeleted: true } }),
    ]);

    // Delete OTP records for this user's email (cleanup)
    if (user.email) {
      await OtpModel.deleteMany({ email: user.email });
    }

    return true;
  },

  async verifyOtp(email: string, otp: string): Promise<boolean> {
    const user = await UserModel.findOne({ email });
    if (!user) throw new Error("Email không hợp lệ");
    const otpRecord = await OtpModel.findOne({ email: email, otp: otp });
    if (!otpRecord) throw new BadRequestError("OTP không hợp lệ hoặc đã hết hạn");
    await UserModel.findByIdAndUpdate(user._id, { verify: true });
    await OtpModel.deleteOne({ _id: otpRecord._id });
    return true;
  },

  async updateUserById(userId: string, updateData: Partial<Pick<UserDoc, 'username' | 'email' | 'role' | 'verify'>>): Promise<EnrichedUser> {
    const user = await UserModel.findById(userId);
    // Sửa lỗi: Dùng NotFoundError và kiểm tra isDeleted
    if (!user || user.isDeleted) throw new NotFoundError('Không tìm thấy người dùng.');
    return this.updateUser(userId, updateData);
  },

  async createUserByAdmin(data: { username: string; email: string; password: string; role: UserRole; verify?: boolean }): Promise<UserDoc> {
    const { username, email, password, role, verify = true } = data;
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) throw new ConflictError('Email đã được sử dụng.');
    
    // Tương tự createUser, lấy thông tin gói cước để gán token
    const userPlan = await PlanModel.findOne({ slug: 'free' }).lean(); // Giả sử admin tạo user cũng mặc định là free
    
    const newDirectory = await DirectoryModel.create({ name: `${username}'s Directory`, creator_id: new mongoose.Types.ObjectId() });
    const user = new UserModel({
      username,
      email,
      password,
      role,
      directory_id: newDirectory._id,
      verify: verify,
      plan: 'free',
      remainingTokens: userPlan?.tokenAllotment || 10, // Gán token, fallback về 10 nếu không tìm thấy plan
    });
    await user.save();
    newDirectory.creator_id = user._id as mongoose.Types.ObjectId;
    await newDirectory.save();
    const plainUserResult = user.toObject();
    delete (plainUserResult as any).password;
    return plainUserResult as UserDoc;
  },
};