import { Request } from "express";
import rateLimit from "express-rate-limit";
import { TooMuchReqError } from "../errors";
import { UserDoc } from "../models/user.model";

export const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 500, // Giới hạn mỗi IP/user là 500 yêu cầu mỗi giờ
  standardHeaders: true, // Trả về thông tin rate limit trong header `RateLimit-*`
  legacyHeaders: false, // Tắt các header `X-RateLimit-*` cũ

  keyGenerator: (req: Request): string => {
    const user = (req as any).user as UserDoc | undefined;

    if (user?._id) {
      return user._id.toString();
    }

    return (req as any).fingerprint?.hash || req.ip;
  },

  skip: (req: Request): boolean => {
    const user = (req as any).user as UserDoc | undefined;
    return user?.role === 'admin';
  },

  handler: (req, res, next) => {
    next(new TooMuchReqError("Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 giờ."));
  },
});