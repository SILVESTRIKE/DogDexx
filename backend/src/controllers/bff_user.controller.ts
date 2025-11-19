import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { authService } from '../services/auth.service';
import { Types } from 'mongoose';
import { collectionService } from '../services/user_collections.service';
import { predictionHistoryService } from '../services/prediction_history.service';
import { transformMediaURLs } from '../utils/media.util';
import { BadRequestError, AppError, NotFoundError } from '../errors';
import { subscriptionService } from '../services/subscription.service';
import { REDIS_KEYS } from '../constants/redis.constants';
import { redisClient } from '../utils/redis.util';
import { tokenConfig } from '../config/token.config';
import { NextFunction } from 'express';
import { userController } from './user.controller';
import { RegisterSchema, UpdateProfileSchema } from '../types/zod/user.zod'; 

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
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
  } catch (error) {
    next(error); // Chuyển lỗi cho middleware xử lý lỗi chung
  }
};

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user!._id;
    const lang = (req.headers['accept-language']?.split(',')[0].toLowerCase() === 'vi') ? 'vi' : 'en';

    const [user, collection, historyResult] = await Promise.all([
      userService.getById(userId.toString()),
      collectionService.getUserCollection(userId, lang),
      predictionHistoryService.getHistoryForUser(userId, { page: 1, limit: 5 })
    ]);

    if (!user) {
      return next(new NotFoundError("Không tìm thấy thông tin người dùng."));
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
  } catch (error) {
    next(error);
  }
};

export const getSessionStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if ((req as any).user) {
      // Chuyển tiếp request, nhưng cần đảm bảo getProfile cũng xử lý lỗi
      return getProfile(req, res, next);
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

    const key = `${REDIS_KEYS.GUEST_TOKEN_PREFIX}${identifier}`;

    let currentTokensStr = await redisClient.get(key);
    if (currentTokensStr === null) {
      await redisClient.set(key, tokenConfig.guest.initialTokens, {
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
    next(error);
  }
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = RegisterSchema.shape.body.safeParse(req.body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(', ');
      // Ném lỗi để middleware xử lý lỗi chung có thể bắt được
      throw new BadRequestError(errorMessage);
    }
    const userData = validationResult.data;

    console.log('[BFF_CONTROLLER] Bắt đầu xử lý request đăng ký...');
    const avatarFile = req.file;
    console.log('[BFF_CONTROLLER] Dữ liệu nhận được:', { ...userData, password: '***' });
    if (avatarFile) console.log('[BFF_CONTROLLER] Đã nhận được file avatar:', avatarFile.originalname);

    const newUser = await userService.createUser(userData, avatarFile);
    console.log('[BFF_CONTROLLER] Tạo người dùng thành công. Chuẩn bị gửi response.');
    res.status(201).json({
      message: "Tài khoản đã được tạo. Vui lòng kiểm tra email để lấy mã OTP xác thực.",
      user: newUser,
    });
  } catch (error) {
    console.error('[BFF_CONTROLLER] Lỗi trong quá trình đăng ký:', error);
    next(error);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validationResult = UpdateProfileSchema.shape.body.safeParse(req.body);
     if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(', ');
      throw new BadRequestError(errorMessage);
    }
    const updateData = validationResult.data;
      
    const userId = (req as any).user!._id.toString();
    const avatarFile = req.file;

    const updatedUser = await userService.updateUser(userId, updateData, avatarFile);
    res.status(200).json({
      message: "Cập nhật hồ sơ thành công.",
      data: transformMediaURLs(req, updatedUser),
    });
  } catch (error) {
    next(error);
  }
};

export const updateAvatar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user!._id.toString();
    const avatarFile = req.file;
    if (!avatarFile) throw new BadRequestError("Vui lòng cung cấp file ảnh avatar.");
    const updatedUser = await userService.updateAvatar(userId, avatarFile);
    res.status(200).json({
      message: "Cập nhật ảnh đại diện thành công.",
      data: { user: transformMediaURLs(req, updatedUser) },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    res.status(200).json({ message: "Đăng xuất thành công." });
  } catch (error) {
    next(error);
  }
};

export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp } = req.body;
    await authService.verifyEmail(email, otp);
    res.status(200).json({ message: "Xác thực tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ." });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken: oldRefreshToken } = req.body;
    if (!oldRefreshToken) {
      return res.status(400).json({ message: "refreshToken is required." });
    }
    const { accessToken, refreshToken } = await authService.refreshToken(oldRefreshToken);
    res.status(200).json({ accessToken, refreshToken });
  } catch (error) { 
    next(error); 
  }
};

export const createCheckoutSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user!._id.toString();
    const { planId, billingPeriod } = req.body;
    const session = await subscriptionService.createCheckoutSession(userId, planId, billingPeriod);
    res.status(200).json(session);
  } catch (error) {
    next(error);
  }
};


export const handleMomoIpn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.status(204).send();

      await subscriptionService.handleMomoIpn(req.body);

    } catch (error) {
      next(error);
    }

  }

// --- BFF wrappers for forgot/reset password (forward to existing user controller)
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return userController.forgotPassword(req as any, res as any);
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return userController.resetPassword(req as any, res as any);
  } catch (error) {
    next(error);
  }
};
 
export const deleteCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return userController.deleteCurrentUser(req as any, res as any);
  } catch (error) {
    next(error);
  }
};
