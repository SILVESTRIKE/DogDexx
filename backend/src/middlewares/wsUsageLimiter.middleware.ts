import { Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { UserModel } from "../models/user.model";
import { BadRequestError, TooMuchReqError } from "../errors";

const ONE_WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const LIMITS = {
  user: { stream: 5 }, // Giới hạn 5 phiên stream mỗi tuần cho user
};

// Limiter cho Guest: 5 phiên/tuần/IP
const guestStreamLimiter = rateLimit({
  windowMs: 7 * 24 * 60 * 60 * 1000,
  max: 5,
  message: { message: "Bạn đã hết lượt dùng thử live stream trong tuần này." },
  keyGenerator: (req: Request) => {
    // SỬA LỖI: Ưu tiên fingerprint, nếu không có thì dùng req.ip.
    // Thêm fallback 'unknown' để đảm bảo hàm luôn trả về một string.
    return req.fingerprint?.hash || (req.ip ? ipKeyGenerator(req.ip) : 'unknown');
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const checkStreamUsageLimit = async (req: Request, res: Response, next: NextFunction) => {
  // Nếu là khách -> dùng IP limiter
  if (!req.user) {
    return guestStreamLimiter(req, res, next);
  }

  // Nếu là người dùng đã đăng nhập -> kiểm tra DB
  try {
    const dbUser = await UserModel.findById(req.user._id);
    if (!dbUser) return next(new BadRequestError("Người dùng không hợp lệ."));
    if (dbUser.role === "admin") return next();

    const now = new Date();
    if (now.getTime() - (dbUser.lastUsageResetAt?.getTime() || 0) > ONE_WEEK_IN_MS) {
      dbUser.photoUploadsThisWeek = 0;
      dbUser.videoUploadsThisWeek = 0;
      dbUser.lastUsageResetAt = now;
      await dbUser.save();
    }

    if (dbUser.role === "user" && dbUser.videoUploadsThisWeek >= LIMITS.user.stream) {
      return next(new TooMuchReqError(`Bạn đã đạt giới hạn ${LIMITS.user.stream} lượt live stream/tuần.`));
    }

    next();
  } catch (error) {
    next(error);
  }
};