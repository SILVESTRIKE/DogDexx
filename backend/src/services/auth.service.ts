import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { userService, EnrichedUser } from "./user.service";
import { UserModel, UserDoc } from "../models/user.model";
import {
  NotAuthorizedError,
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../errors";
import { OtpModel, OtpType } from "../models/otp.model";
import { emailService } from "./email.service";
import crypto from "crypto";
import { redisClient } from "../utils/redis.util";
import { REDIS_KEYS } from "../constants/redis.constants";
import { logger } from "../utils/logger.util";
import { tokenConfig } from "../config/token.config";

// Helper tạo JTI ngẫu nhiên
const generateJti = () => crypto.randomBytes(16).toString("hex");

const generateTokens = (user: EnrichedUser | UserDoc, jti: string) => {
  const accessToken = jwt.sign(
    { id: user.id, role: user.role, plan: user.plan },
    tokenConfig.access.secret,
    {
      expiresIn: tokenConfig.access.expirationSeconds, 
    }
  );
  const refreshToken = jwt.sign(
    { id: user.id, jti }, // Quan trọng: Phải có jti trong payload
    tokenConfig.refresh.secret,
    {
      expiresIn: tokenConfig.refresh.expirationSeconds,
    }
  );
  return { accessToken, refreshToken };
};

// ... (Giữ nguyên các hàm saveOtp, sendOtpEmail) ...
async function saveOtp(email: string, otp: string, type: OtpType) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await OtpModel.create({ email, otp, type, expiresAt });
}
  
async function sendOtpEmail(email: string, otp: string, subject: string, text: string) {
    try {
      await emailService.sendEmail(email, subject, text.replace("{{otp}}", otp));
    } catch (error) {
      logger.error("Lỗi gửi mail:", error);
      throw new Error("Không thể gửi email");
    }
}

export const authService = {
  async login(
    email: string,
    password: string
  ): Promise<{
    user: Awaited<ReturnType<typeof userService.getById>>;
    accessToken: string;
    refreshToken: string;
  }> {
    const cleanEmail = email.trim().toLowerCase();
    const userWithPassword = await UserModel.findOne({
      email: cleanEmail,
      isDeleted: false,
    }).select("+password");

    if (!userWithPassword || !userWithPassword.password) {
      throw new NotAuthorizedError("Email hoặc mật khẩu không chính xác.");
    }

    const isMatch = await bcrypt.compare(password, userWithPassword.password);
    if (!isMatch) {
      throw new NotAuthorizedError("Email hoặc mật khẩu không chính xác.");
    }

    if (!userWithPassword.verify) {
      try {
        await this.resendVerificationOtp(userWithPassword.email);
        throw new BadRequestError(
          "Tài khoản chưa được xác thực. Mã OTP mới đã được gửi đến email của bạn."
        );
      } catch (error: any) {
        if (error instanceof BadRequestError) throw error;
        throw new BadRequestError(
          "Tài khoản chưa xác thực. Vui lòng chọn 'Đăng ký' lại bằng email này để nhận mã mới."
        );
      }
    }

    const enrichedUser = await userService.getById(userWithPassword.id);
    if (!enrichedUser) {
      throw new NotFoundError("Lỗi hệ thống: Không lấy được thông tin người dùng.");
    }

    // --- SỬA ĐỔI QUAN TRỌNG TẠI ĐÂY ---
    // 1. Tạo JTI mới
    const jti = generateJti();

    // 2. Truyền JTI vào hàm tạo token
    const { accessToken, refreshToken } = generateTokens(enrichedUser, jti);

    // 3. Lưu JTI vào Redis theo Key của UserID (Set structure)
    if (redisClient) {
      const key = `${REDIS_KEYS.REFRESH_TOKEN_PREFIX}${enrichedUser.id}`;
      
      // Thêm JTI vào danh sách hợp lệ của user
      await redisClient.sAdd(key, jti);
      
      // Cập nhật thời gian hết hạn cho cả Key (bằng thời gian refresh token)
      await redisClient.expire(key, tokenConfig.refresh.expirationSeconds);
    }

    return { user: enrichedUser, accessToken, refreshToken };
  },

  async logout(refreshToken: string): Promise<void> {
    if (!refreshToken) throw new BadRequestError("Refresh token là bắt buộc.");
    if (!redisClient) return;

    try {
      // Giải mã token để lấy UserID và JTI
      const decoded = jwt.verify(refreshToken, tokenConfig.refresh.secret) as {
        id: string;
        jti: string;
      };

      // Xóa JTI cụ thể khỏi Redis Set của user đó
      const key = `${REDIS_KEYS.REFRESH_TOKEN_PREFIX}${decoded.id}`;
      await redisClient.sRem(key, decoded.jti);
      
    } catch (error) {
      // Nếu token lỗi hoặc hết hạn thì coi như đã logout thành công
      logger.warn("Logout with invalid/expired token ignored.");
    }
  },

  async refreshToken(
    oldRefreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!oldRefreshToken) {
      throw new BadRequestError("Refresh token là bắt buộc.");
    }
    if (!redisClient) {
      throw new Error("Redis client not available, cannot refresh token.");
    }

    let decoded: { id: string; jti: string };
    try {
      decoded = jwt.verify(oldRefreshToken, tokenConfig.refresh.secret) as {
        id: string;
        jti: string;
      };
    } catch (error) {
      throw new NotAuthorizedError("Refresh token không hợp lệ hoặc đã hết hạn.");
    }

    const { id: userId, jti: oldJti } = decoded;
    const key = `${REDIS_KEYS.REFRESH_TOKEN_PREFIX}${userId}`;

    // Kiểm tra xem JTI cũ có trong Redis không
    const isTokenValid = await redisClient.sIsMember(key, oldJti);

    if (!isTokenValid) {
      // Token reuse detection: Nếu token hợp lệ (signature) nhưng không có trong Redis,
      // có thể nó đã bị dùng rồi -> Xóa toàn bộ phiên của user để bảo mật.
      await redisClient.del(key);
      throw new NotAuthorizedError(
        "Phiên đăng nhập không hợp lệ (Token Reuse). Vui lòng đăng nhập lại."
      );
    }

    // Xóa JTI cũ (Token Rotation: Token cũ chết ngay khi dùng)
    await redisClient.sRem(key, oldJti);

    const user = await userService.getById(userId);
    if (!user) throw new NotAuthorizedError("Người dùng không tồn tại.");

    // Tạo cặp token mới với JTI mới
    const newJti = generateJti();
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user,
      newJti
    );

    // Lưu JTI mới vào Redis
    await redisClient.sAdd(key, newJti);
    await redisClient.expire(key, tokenConfig.refresh.expirationSeconds);

    return { accessToken, refreshToken: newRefreshToken };
  },

  // ... (Giữ nguyên các hàm resendVerificationOtp, verifyEmail, forgotPassword, resetPassword) ...
  async resendVerificationOtp(email: string) {
    const user = await userService.getByEmail(email);
    if (!user) {
      throw new ConflictError("Không tìm thấy người dùng với email này.");
    }
    if (user.verify) {
      throw new BadRequestError("Tài khoản này đã được xác thực.");
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    await saveOtp(email, otp, OtpType.EMAIL_VERIFICATION);

    await sendOtpEmail(
      email,
      otp,
      "Xác thực tài khoản của bạn",
      `Mã OTP xác thực tài khoản của bạn là {{otp}}. Mã này sẽ hết hạn sau 10 phút.`
    );

    return { message: "OTP xác thực đã được gửi lại đến email của bạn." };
  },

  async verifyEmail(email: string, otp: string) {
    const existingOtp = await OtpModel.findOne({
      email,
      otp,
      type: OtpType.EMAIL_VERIFICATION,
    });
    if (!existingOtp) {
      throw new BadRequestError("OTP không hợp lệ hoặc đã hết hạn.");
    }
    const userDoc = await UserModel.findOne({ email, isDeleted: false });
    if (!userDoc) {
      throw new ConflictError("Không tìm thấy người dùng.");
    }

    userDoc.verify = true;
    await userDoc.save();
    await OtpModel.deleteMany({ email, type: OtpType.EMAIL_VERIFICATION });
    return { message: "Xác thực email thành công." };
  },

  async forgotPassword(email: string) {
    const user = await userService.getByEmail(email);
    if (!user) {
      return {
        message: "Nếu tài khoản tồn tại, một mã OTP sẽ được gửi đến email của bạn.",
      };
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    await saveOtp(email, otp, OtpType.PASSWORD_RESET);

    await sendOtpEmail(
      email,
      otp,
      "Yêu cầu đặt lại mật khẩu",
      `Mã OTP đặt lại mật khẩu của bạn là {{otp}}. Mã này sẽ hết hạn sau 10 phút.`
    );

    return {
      message: "Nếu tài khoản tồn tại, một mã OTP sẽ được gửi đến email của bạn.",
    };
  },

  async resetPassword(email: string, otp: string, newPassword: string) {
    const existingOtp = await OtpModel.findOne({
      email,
      otp,
      type: OtpType.PASSWORD_RESET,
    });
    if (!existingOtp) {
      throw new BadRequestError("OTP không hợp lệ hoặc đã hết hạn.");
    }

    const userDoc = await UserModel.findOne({ email, isDeleted: false }).select("+password");
    if (!userDoc) {
      throw new ConflictError("Không tìm thấy người dùng.");
    }

    userDoc.password = newPassword;
    await userDoc.save();

    await OtpModel.deleteMany({ email, type: OtpType.PASSWORD_RESET });
    
    // Xóa tất cả phiên đăng nhập khi đổi mật khẩu
    if (redisClient) {
      const key = `${REDIS_KEYS.REFRESH_TOKEN_PREFIX}${userDoc._id}`;
      await redisClient.del(key);
    }

    return { message: "Mật khẩu đã được đặt lại thành công." };
  },
};