// BFF User Controller
import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { authService } from '../services/auth.service';
import { collectionService } from '../services/user_collections.service';
import { predictionHistoryService } from '../services/prediction_history.service';
import { tokenService } from '../services/token.service';
import { transformMediaURLs } from '../utils/media.util';
import { Types } from 'mongoose';

export const register = async (req: Request, res: Response) => {
  // 1. Call core user service to create user, directory, and send OTP
  const newUser = await userService.createUser(req.body);

  // 2. The collection is created implicitly when a breed is first discovered.
  // No need to create an empty collection here.

  res.status(201).json({
    message: "Tài khoản đã được tạo. OTP đã được gửi đến email của bạn để xác thực.",
    data: newUser,
  });
};

export const login = async (req: Request, res: Response) => {
  // 1. Call core auth service to login and get tokens
  const { user, accessToken, refreshToken } = await authService.login(req.body.email, req.body.password);

  // 2. Get user's collection
  const collection = await collectionService.getUserCollection(user._id as Types.ObjectId);

  // 3. Send aggregated response
  res.status(200).json({
    message: "Đăng nhập thành công!",
    data: {
      user,
      accessToken,
      refreshToken,
      collection,
    }
  });
};

export const getProfile = async (req: Request, res: Response) => {
  const userId = req.user!._id;

  // 1. Aggregate data from multiple services in parallel
  const [user, collection, historyResult] = await Promise.all([
    userService.getById(userId.toString()),
    collectionService.getUserCollection(userId),
    predictionHistoryService.getHistoryForUser(userId, { page: 1, limit: 5 }) // Get latest 5 predictions
  ]);

  // 2. Transform URLs for history
  const transformedHistories = historyResult.histories.map(h => transformMediaURLs(req, h));

  // 3. Send aggregated response
  res.status(200).json({
    message: "Lấy thông tin hồ sơ thành công.",
    data: {
      user,
      collection,
      history: { ...historyResult, histories: transformedHistories },
    }
  });
};

export const updateProfile = async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const updatedUser = await userService.updateUser(userId, req.body);
  res.status(200).json({ message: "Cập nhật hồ sơ thành công.", data: updatedUser });
};

export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken);
  // Frontend is responsible for clearing its local cache/storage
  res.status(200).json({ message: "Đăng xuất thành công." });
};
