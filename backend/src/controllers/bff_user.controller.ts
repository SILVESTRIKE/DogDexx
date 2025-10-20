// BFF User Controller (Đã sửa lỗi và tối ưu hóa)
import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { authService } from '../services/auth.service';
import { collectionService } from '../services/user_collections.service';
import { predictionHistoryService } from '../services/prediction_history.service';
import { transformMediaURLs } from '../utils/media.util';
import { Types } from 'mongoose';
import { RegisterSchema } from '../types/zod/user.zod';
import { z } from 'zod';
import { BadRequestError } from '../errors';

export const register = async (req: Request, res: Response) => {
  // Dữ liệu từ form-data sẽ nằm trong req.body và req.file
  const userData = req.body as z.infer<typeof RegisterSchema.shape.body>;
  const avatarFile = req.file;

  // 1. Call core user service to create user, directory, and send OTP
  const newUser = await userService.createUser(userData, avatarFile);

  // 2. The collection is created implicitly when a breed is first discovered.
  // No need to create an empty collection here.

  res.status(201).json({
    message: "Tài khoản đã được tạo. Vui lòng kiểm tra email để lấy mã OTP xác thực.",
    user: newUser, // Trả về user để frontend biết email cần xác thực
  });
};

export const login = async (req: Request, res: Response) => {
  // 1. Gọi authService, 'user' trả về đã là một object đầy đủ và đúng kiểu.
  const { user, accessToken, refreshToken } = await authService.login(req.body.email, req.body.password);

  if (!user) {
    // Biện pháp phòng ngừa, mặc dù authService sẽ ném lỗi trước đó.
    return res.status(500).json({ message: "Lỗi xảy ra trong quá trình đăng nhập." });
  }

  // 2. Lấy userId một cách an toàn. Dòng này sẽ hoạt động hoàn hảo.
  const userId = user._id.toString();

  // 3. Chỉ cần lấy thêm collection. KHÔNG cần gọi lại userService.getById.
  const collection = await collectionService.getUserCollection(new Types.ObjectId(userId));

  // 4. Gửi phản hồi với dữ liệu đã được tối ưu.
  res.status(200).json({
    message: "Đăng nhập thành công!",
    user: transformMediaURLs(req, user),
    tokens: {
      accessToken,
      refreshToken,
    },
    collection,
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

  // Kiểm tra nếu không tìm thấy user
  if (!user) {
    return res.status(404).json({ message: "Không tìm thấy thông tin người dùng." });
  }

  // 2. Transform URLs for history
  const transformedHistories = historyResult.histories.map(h => transformMediaURLs(req, h));

  // 3. Send aggregated response
  res.status(200).json({
    message: "Lấy thông tin hồ sơ thành công.",
    data: {
      user: transformMediaURLs(req, user), // Chuyển đổi URL cho avatar
      collection,
      history: { ...historyResult, histories: transformedHistories },
    }
  });
};

export const updateProfile = async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const updateData = req.body;
  const avatarFile = req.file;

  const updatedUser = await userService.updateUser(userId, updateData, avatarFile);

  res.status(200).json({
    message: "Cập nhật hồ sơ thành công.",
    data: transformMediaURLs(req, updatedUser),
  });
};

export const updateAvatar = async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const avatarFile = req.file;

  if (!avatarFile) {
    throw new BadRequestError("Vui lòng cung cấp file ảnh avatar.");
  }
  const updatedUser = await userService.updateAvatar(userId, avatarFile);
  res.status(200).json({ message: "Cập nhật ảnh đại diện thành công.", data: transformMediaURLs(req, updatedUser) });
};

export const logout = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken);
  // Frontend is responsible for clearing its local cache/storage
  res.status(200).json({ message: "Đăng xuất thành công." });
};

export const verifyOtp = async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  // Gọi đến core service để xác thực
  await authService.verifyEmail(email, otp);
  res.status(200).json({ message: "Xác thực tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ." });
};

export const refreshToken = async (req: Request, res: Response) => {
  const { refreshToken: oldRefreshToken } = req.body;
  const { accessToken, refreshToken } = await authService.refreshToken(
    oldRefreshToken
  );
  res.status(200).json({ accessToken, refreshToken });
};