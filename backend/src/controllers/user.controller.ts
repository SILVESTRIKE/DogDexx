import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { authService } from "../services/auth.service";

import {
  LoginType,
  RegisterType,
  ResendVerificationOtpType,
  VerifyEmailType,
  ForgotPasswordType,
  ResetPasswordType,
  UpdateProfileType,
} from "../types/zod/user.zod";

export const userController = {
  // --- AUTH CONTROLLERS ---
  register: async (req: Request<{}, {}, RegisterType>, res: Response) => {
    const newUser = await userService.createUser(req.body);
    res.status(201).json({
      message:
        "Tài khoản đã được tạo. OTP đã được gửi đến email của bạn để xác thực.",
      user: newUser,
    });
  },

  login: async (req: Request<{}, {}, LoginType>, res: Response) => {
    const { user, accessToken, refreshToken } = await authService.login(
      req.body.email,
      req.body.password
    );
    res.status(200).json({
      message: "Đăng nhập thành công!",
      user,
      accessToken,
      refreshToken,
    });
  },

  logout: async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    res.status(200).json({ message: "Đăng xuất thành công." });
  },

  refreshToken: async (req: Request, res: Response) => {
    const { refreshToken: oldRefreshToken } = req.body;
    const { accessToken, refreshToken } = await authService.refreshToken(
      oldRefreshToken
    );
    res.status(200).json({ accessToken, refreshToken });
  },

  // --- OTP & PASSWORD CONTROLLERS ---
  resendVerificationOtp: async (
    req: Request<{}, {}, ResendVerificationOtpType>,
    res: Response
  ) => {
    const result = await authService.resendVerificationOtp(req.body.email);
    res.status(200).json(result);
  },

  verifyEmail: async (req: Request<{}, {}, VerifyEmailType>, res: Response) => {
    const result = await authService.verifyEmail(req.body.email, req.body.otp);
    res.status(200).json(result);
  },

  forgotPassword: async (
    req: Request<{}, {}, ForgotPasswordType>,
    res: Response
  ) => {
    const result = await authService.forgotPassword(req.body.email);
    res.status(200).json(result);
  },

  resetPassword: async (req: Request<{}, {}, ResetPasswordType>, res: Response) => {
    const result = await authService.resetPassword(
      req.body.email,
      req.body.otp,
      req.body.password
    );
    res.status(200).json(result);
  },

  // --- USER MANAGEMENT CONTROLLERS ---
  getProfile: async (req: Request, res: Response) => {
    res.status(200).json(req.user);
  },

  updateProfile: async (
    req: Request<{}, {}, UpdateProfileType>,
    res: Response
  ) => {
    const userId = req.user!._id.toString();
    const updatedUser = await userService.updateUser(userId, req.body);
    res.status(200).json(updatedUser);
  },

  deleteCurrentUser: async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    await userService.deleteUser(userId);
    res
      .status(200)
      .json({ message: "Tài khoản của bạn đã được xóa thành công." });
  },

  // --- ADMIN CONTROLLERS ---
  getAllUsers: async (req: Request, res: Response) => {
    const users = await userService.getAll();
    res.status(200).json(users);
  },

  adminDeleteUser: async (req: Request, res: Response) => {
    await userService.deleteUser(req.params.id);
    res.status(200).json({ message: "Người dùng đã được xóa thành công." });
  },
};