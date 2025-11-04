import jwt, { Secret, SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { RefreshTokenModel } from "../models/refreshToken.model";
import { UserDoc } from "../models/user.model";
import { userService, EnrichedUser } from "./user.service"; // THAY ĐỔI: Import EnrichedUser
import { NotAuthorizedError } from "../errors";

const generateToken = (
  payload: object,
  secret: Secret,
  options: SignOptions
) => {
  return jwt.sign(payload, secret, options);
};

export const tokenService = {
  // THAY ĐỔI: Chấp nhận cả UserDoc hoặc EnrichedUser
  async createTokens(
    user: UserDoc | EnrichedUser
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const userId = (user._id as any).toString();
    const jti = new Types.ObjectId().toString();

    const accessTokenPayload = { userId, role: user.role };
    const refreshTokenPayload = { userId, jti };

    const accessTokenOptions: SignOptions = {
      expiresIn: process.env.JWT_ACCESS_EXPIRATION as jwt.SignOptions["expiresIn"],
    };
    const refreshTokenOptions: SignOptions = {
      expiresIn: process.env.JWT_REFRESH_EXPIRATION as jwt.SignOptions["expiresIn"],
    };

    const accessToken = generateToken(accessTokenPayload, process.env.JWT_SECRET as Secret, accessTokenOptions);
    const refreshToken = generateToken(refreshTokenPayload, process.env.JWT_REFRESH_SECRET as Secret, refreshTokenOptions);

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + parseInt(process.env.JWT_REFRESH_EXPIRATION_SECONDS!, 10));

    const hashedToken = await bcrypt.hash(refreshToken, 10);
    await RefreshTokenModel.create({
      user: userId,
      jti,
      token: hashedToken,
      expiresAt,
    });

    return { accessToken, refreshToken };
  },
  
  // Các hàm khác không cần thay đổi logic nhưng để đầy đủ tôi sẽ thêm vào
  async deleteRefreshToken(token: string): Promise<void> {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET! as Secret
      ) as { jti: string };
      await RefreshTokenModel.deleteOne({ jti: decoded.jti });
    } catch (error) {
      console.error("Attempted to log out with invalid token:", (error as Error).message);
    }
  },

  async rotateRefreshToken(
    oldToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let decoded: { userId: string; jti: string };
    try {
      decoded = jwt.verify(
        oldToken,
        process.env.JWT_REFRESH_SECRET! as Secret
      ) as { userId: string; jti: string };
    } catch (error) {
      throw new NotAuthorizedError("Refresh token không hợp lệ hoặc đã hết hạn.");
    }

    const dbToken = await RefreshTokenModel.findOne({ jti: decoded.jti });
    if (!dbToken) {
      const compromisedUser = await userService.getById(decoded.userId);
      if (compromisedUser) await RefreshTokenModel.deleteMany({ user: compromisedUser._id });
      throw new NotAuthorizedError("Phiên đăng nhập không hợp lệ.");
    }

    if (dbToken.used) {
      await RefreshTokenModel.deleteMany({ user: dbToken.user });
      throw new NotAuthorizedError("Phát hiện hành vi đáng ngờ. Tất cả phiên đăng nhập đã bị hủy. Vui lòng đăng nhập lại.");
    }

    const user = await userService.getById(decoded.userId);
    if (!user) throw new NotAuthorizedError("Người dùng không tồn tại.");

    dbToken.used = true;
    await dbToken.save();

    return this.createTokens(user);
  },
};