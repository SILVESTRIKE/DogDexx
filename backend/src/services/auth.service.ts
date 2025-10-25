import bcrypt from "bcryptjs";
import { userService, EnrichedUser } from "./user.service";
import { UserModel } from "../models/user.model";
import { tokenService } from "./token.service";
import { RefreshTokenModel } from "../models/refreshToken.model";
import { NotAuthorizedError, BadRequestError, ConflictError } from "../errors";
import { OtpModel, OtpType } from "../models/otp.model";
import { sendEmail } from "./email.service";
import crypto from "crypto";

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
    await sendEmail(email, subject, text.replace("{{otp}}", otp));
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
    user: EnrichedUser;
    accessToken: string;
    refreshToken: string;
  }> {
    // SỬA LỖI: Lấy trực tiếp Mongoose document để đảm bảo có trường password
    const userDoc = await UserModel.findOne({ email, isDeleted: false }).select('+password');
    if (!userDoc || !userDoc.password) {
      throw new NotAuthorizedError("Email hoặc mật khẩu không chính xác.");
    }

    const isMatch = await bcrypt.compare(password, userDoc.password);
    // Sau khi so sánh, xóa trường password khỏi bộ nhớ để bảo mật
    if (!isMatch) {
      throw new NotAuthorizedError("Email hoặc mật khẩu không chính xác.");
    }

    if (!userDoc.verify) {
      await this.resendVerificationOtp(userDoc.email).catch((err) =>
        console.log(err.message)
      );
      throw new BadRequestError(
        "Tài khoản chưa được xác thực. OTP mới đã được gửi đến email của bạn."
      );
    }

    const tokens = await tokenService.createTokens(userDoc);

    // LÀM GIÀU DỮ LIỆU: Sau khi xác thực thành công, gọi service để làm giàu thông tin user
    const enrichedUser = await userService.getById(userDoc.id);

    if (!enrichedUser) {
      throw new NotAuthorizedError("Không thể lấy thông tin chi tiết người dùng sau khi đăng nhập.");
    }

    return { user: enrichedUser as EnrichedUser, ...tokens };
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
    await RefreshTokenModel.deleteMany({
      user: (userDoc._id as any).toString(),
    });

    return { message: "Mật khẩu đã được đặt lại thành công." };
  },
};
