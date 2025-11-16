import bcrypt from "bcryptjs";
import { userService } from "./user.service";
import { UserModel, UserDoc } from "../models/user.model";
import { tokenService } from "./token.service";
import { NotAuthorizedError, BadRequestError, ConflictError } from "../errors";
import { OtpModel, OtpType } from "../models/otp.model";;
import { emailService } from "./email.service";
import crypto from "crypto";
import { redisClient } from "../utils/redis.util";
import { REDIS_KEYS } from "../constants/redis.constants";
import { logger } from "../utils/logger.util";

async function saveOtp(email: string, otp: string, type: OtpType) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await OtpModel.create({ email, otp, type, expiresAt });
}

async function sendOtpEmail(
  email: string,
  otp: string,
  subject: string,
  text: string
) {
  try {
    await emailService.sendEmail(email, subject, text.replace("{{otp}}", otp));
    console.log("Noi dung email:", text.replace("{{otp}}", otp));
  } catch (error) {
    console.error("Lỗi gửi mail:", error);
    throw new Error("Không thể gửi email");
  }
}

export const authService = {
  async login(
  email: string,
  password: string
): Promise<{
  user: Omit<UserDoc, 'password'>; 
  accessToken: string;
  refreshToken: string;
}> {
  const userWithPassword = await UserModel.findOne({ email, isDeleted: false }).select('+password');

  if (!userWithPassword || !userWithPassword.password) {
    throw new NotAuthorizedError("Email hoặc mật khẩu không chính xác.");
  }

  const isMatch = await bcrypt.compare(password, userWithPassword.password);
  if (!isMatch) {
    throw new NotAuthorizedError("Email hoặc mật khẩu không chính xác.");
  }

  if (!userWithPassword.verify) {
    await this.resendVerificationOtp(userWithPassword.email).catch((err) =>
      console.log(err.message)
    );
    throw new BadRequestError(
      "Tài khoản chưa được xác thực. OTP mới đã được gửi đến email của bạn."
    );
  }

  const tokens = await tokenService.createTokens(userWithPassword);

  const userObject = userWithPassword.toObject();

  return { user: userObject, ...tokens };
},

  async logout(refreshToken: string): Promise<void> {
    if (!refreshToken) {
      throw new BadRequestError("Refresh token là bắt buộc.");
    }
    await tokenService.deleteRefreshToken(refreshToken);
  },

  async refreshToken(
    token: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!token) {
      throw new BadRequestError("Refresh token là bắt buộc.");
    }
    return tokenService.rotateRefreshToken(token);
  },

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

    // Fetch the actual Mongoose document so we can call .save()
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
      // Don't reveal that the user doesn't exist
      return {
        message:
          "Nếu tài khoản tồn tại, một mã OTP sẽ được gửi đến email của bạn.",
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
      message:
        "Nếu tài khoản tồn tại, một mã OTP sẽ được gửi đến email của bạn.",
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

    const userDoc = await UserModel.findOne({ email, isDeleted: false }).select(
      "+password"
    );
    if (!userDoc) {
      throw new ConflictError("Không tìm thấy người dùng.");
    }

    userDoc.password = newPassword;
    await userDoc.save();

    await OtpModel.deleteMany({ email, type: OtpType.PASSWORD_RESET });
    // Xóa tất cả các refresh token của người dùng trong Redis
    if (redisClient) {
      const userId = (userDoc._id as any).toString();
      const keys = await redisClient.keys(`${REDIS_KEYS.REFRESH_TOKEN_PREFIX}${userId}:*`);
      if (keys.length > 0) await redisClient.del(keys);
      logger.info(`[AuthService] Deleted ${keys.length} refresh tokens for user ${userId} after password reset.`);
    }

    return { message: "Mật khẩu đã được đặt lại thành công." };
  },
};
