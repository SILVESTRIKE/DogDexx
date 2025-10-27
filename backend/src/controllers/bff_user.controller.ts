import { Request, Response } from 'express';
import { userService, EnrichedUser } from '../services/user.service';
import { authService } from '../services/auth.service';
import { Types } from 'mongoose';
import { collectionService } from '../services/user_collections.service';
import { predictionHistoryService } from '../services/prediction_history.service';
import { transformMediaURLs } from '../utils/media.util';
import { BadRequestError, AppError, NotFoundError } from '../errors';
import { subscriptionService } from '../services/subscription.service';
import { redisClient } from '../utils/redis.util';
import { tokenConfig } from '../config/token.config';
import { NextFunction } from 'express-serve-static-core';
export const login = async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body.email, req.body.password);
  
  // authService -> userService đã trả về user được làm giàu
  const lang = (req.headers['accept-language']?.split(',')[0].toLowerCase() === 'vi') ? 'vi' : 'en';
  const collection = await collectionService.getUserCollection(new Types.ObjectId(user.id), lang);

  res.status(200).json({
    message: "Đăng nhập thành công!",
    user: transformMediaURLs(req, user),
    tokens: { accessToken, refreshToken },
    collection,
  });
};

export const getProfile = async (req: Request, res: Response) => {
  const userId = (req as any).user!._id;
  const lang = (req.headers['accept-language']?.split(',')[0].toLowerCase() === 'vi') ? 'vi' : 'en';

  // userService.getById giờ đây trả về user đã được làm giàu
  const [user, collection, historyResult] = await Promise.all([
    userService.getById(userId.toString()),
    collectionService.getUserCollection(userId, lang),
    predictionHistoryService.getHistoryForUser(userId, { page: 1, limit: 5 })
  ]);

  if (!user) {
    throw new NotFoundError("Không tìm thấy thông tin người dùng.");
  }
  
  const transformedHistories = historyResult.histories.map(h => transformMediaURLs(req, h));

  res.status(200).json({
    message: "Lấy thông tin hồ sơ thành công.",
    data: {
      user: transformMediaURLs(req, user),
      collection,
      history: { ...historyResult, histories: transformedHistories },
    }
  });
};

export const getSessionStatus = async (req: Request, res: Response) => {
  if ((req as any).user) {
    return getProfile(req, res);
  }

  if (!redisClient) {
    return res.status(200).json({
      isGuest: true,
      remainingTokens: tokenConfig.guest.initialTokens,
      tokenAllotment: tokenConfig.guest.initialTokens,
    });
  }

  const identifier = (req as any).fingerprint?.hash || req.ip;
  if (!identifier) {
    throw new BadRequestError("Không thể xác định phiên làm việc.");
  }

  const key = `guest:token:${identifier}`;

  try {
    let currentTokensStr = await redisClient.get(key); // Sử dụng key mới
    if (currentTokensStr === null) {
      await redisClient.set(key, tokenConfig.guest.initialTokens, { // Sử dụng key mới
          EX: tokenConfig.guest.expirationSeconds,
      });
      currentTokensStr = tokenConfig.guest.initialTokens.toString();
    }
    
    res.status(200).json({
      isGuest: true,
      remainingTokens: parseInt(currentTokensStr, 10),
      tokenAllotment: tokenConfig.guest.initialTokens,
    });
  } catch (error) {
    throw new AppError("Lỗi máy chủ khi kiểm tra phiên.");
  }
};

export const register = async (req: Request, res: Response) => {
  const userData = req.body;
  const avatarFile = req.file;
  const newUser = await userService.createUser(userData, avatarFile);
  res.status(201).json({
    message: "Tài khoản đã được tạo. Vui lòng kiểm tra email để lấy mã OTP xác thực.",
    user: newUser,
  });
};

export const updateProfile = async (req: Request, res: Response) => {
  const userId = (req as any).user!._id.toString();
  const updateData = req.body;
  const avatarFile = req.file;
  const updatedUser = await userService.updateUser(userId, updateData, avatarFile);
  res.status(200).json({
    message: "Cập nhật hồ sơ thành công.",
    data: transformMediaURLs(req, updatedUser),
  });
};

export const updateAvatar = async (req: Request, res: Response) => {
  const userId = (req as any).user!._id.toString();
  const avatarFile = req.file;
  if (!avatarFile) throw new BadRequestError("Vui lòng cung cấp file ảnh avatar.");
  const updatedUser = await userService.updateAvatar(userId, avatarFile);
  res.status(200).json({
    message: "Cập nhật ảnh đại diện thành công.",
    data: { user: transformMediaURLs(req, updatedUser) },
  });
};

export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken);
  res.status(200).json({ message: "Đăng xuất thành công." });
};

export const verifyOtp = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  await authService.verifyEmail(email, otp);
  res.status(200).json({ message: "Xác thực tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ." });
};

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken: oldRefreshToken } = req.body;
  const { accessToken, refreshToken } = await authService.refreshToken(oldRefreshToken);
  res.status(200).json({ accessToken, refreshToken });
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  const userId = (req as any).user!._id.toString();
  const { planId, billingPeriod } = req.body;
  const session = await subscriptionService.createCheckoutSession(userId, planId, billingPeriod);
  res.status(200).json(session);
};


export const handleMomoIpn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Phản hồi ngay cho MoMo để tránh việc MoMo gửi lại yêu cầu do timeout.
      res.status(204).send();

      // Sau khi đã phản hồi, tiếp tục xử lý logic cập nhật trong nền.
      // Việc này đảm bảo MoMo không bị treo trong khi server của bạn đang xử lý DB.
      await subscriptionService.handleMomoIpn(req.body);

    } catch (error) {
      next(error);
    }
  }