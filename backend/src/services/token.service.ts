import jwt, { Secret, SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { RefreshTokenModel } from "../models/refreshToken.model";
import { UserDoc } from "../models/user.model";
import { userService, EnrichedUser } from "./user.service";
import { tokenConfig } from "../config/token.config";
import { NotAuthorizedError } from "../errors";
import { logger } from "../utils/logger.util";

const generateToken = (
  payload: object,
  secret: Secret,
  options: SignOptions
) => {
  return jwt.sign(payload, secret, options);
};

export const tokenService = {
  async createTokens(
    user: UserDoc | EnrichedUser
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const userId = (user._id as any).toString();
    const jti = new Types.ObjectId().toString();

    const accessTokenPayload = { userId, role: user.role };
    const refreshTokenPayload = { userId, jti };

    const accessTokenOptions: SignOptions = {
      expiresIn: tokenConfig.access.expirationSeconds,
    };
    const refreshTokenOptions: SignOptions = {
      expiresIn: tokenConfig.refresh.expirationSeconds,
    };

    const accessToken = generateToken(
      accessTokenPayload,
      tokenConfig.access.secret,
      accessTokenOptions
    );
    const refreshToken = generateToken(
      refreshTokenPayload,
      tokenConfig.refresh.secret,
      refreshTokenOptions
    );

    const expiresAt = new Date();
    expiresAt.setSeconds(
      expiresAt.getSeconds() + tokenConfig.refresh.expirationSeconds
    );

    const hashedToken = await bcrypt.hash(refreshToken, 10);
    await RefreshTokenModel.create({
      user: userId,
      jti,
      token: hashedToken,
      expiresAt,
    });

    logger.info(`[TokenService] Created new tokens for user ID: ${userId}`);
    return { accessToken, refreshToken };
  },

  async deleteRefreshToken(token: string): Promise<void> {
    try {
      const decoded = jwt.verify(
        token,
        tokenConfig.refresh.secret
      ) as { jti: string };
      logger.info(`[TokenService] Deleting refresh token with JTI: ${decoded.jti}`);
      await RefreshTokenModel.deleteOne({ jti: decoded.jti });
    } catch (error) {
      logger.error(
        "Attempted to log out with invalid token:",
        (error as Error).message
      );
    }
  },

  async rotateRefreshToken(
    oldToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    logger.info('[TokenService] Attempting to rotate refresh token.');
    let decoded: { userId: string; jti: string };
    try {
      decoded = jwt.verify(oldToken, tokenConfig.refresh.secret) as {
        userId: string;
        jti: string;
      };
    } catch (error) {
      logger.error(`[TokenService] Refresh token rotation failed: Invalid token. Error: ${(error as Error).message}`);
      throw new NotAuthorizedError(
        "Refresh token không hợp lệ hoặc đã hết hạn."
      );
    }

    const dbToken = await RefreshTokenModel.findOne({ jti: decoded.jti });
    if (!dbToken) {
      logger.warn(`[TokenService] Refresh token with JTI ${decoded.jti} not found in DB. Possible token reuse attempt.`);
      const compromisedUser = await userService.getById(decoded.userId);
      if (compromisedUser) {
        logger.warn(`[TokenService] Deleting all refresh tokens for compromised user ID: ${compromisedUser._id}`);
        await RefreshTokenModel.deleteMany({ user: compromisedUser._id });
      }
      throw new NotAuthorizedError("Phiên đăng nhập không hợp lệ.");
    }
    
    if (dbToken.used) {
      await RefreshTokenModel.deleteMany({ user: dbToken.user });
      throw new NotAuthorizedError(
        "Phát hiện hành vi đáng ngờ. Tất cả phiên đăng nhập đã bị hủy. Vui lòng đăng nhập lại."
      );
    }

    const user = await userService.getById(decoded.userId);
    if (!user) throw new NotAuthorizedError("Người dùng không tồn tại.");

    dbToken.used = true;
    await dbToken.save();

    logger.info(`[TokenService] Successfully rotated refresh token for user ID: ${decoded.userId}.`);
    return this.createTokens(user);
  },
};