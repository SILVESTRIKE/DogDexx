import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { UserModel } from "../models/user.model";
import { BadRequestError, TooMuchReqError } from "../errors";

const ONE_WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

const LIMITS = {
  user: { image: 100, video: 5 },
};

// Limiter cho Guest: 5 lần/tuần/IP
const guestLimiter = rateLimit({
  windowMs: 7 * 24 * 60 * 60 * 1000, // 7 ngày (1 tuần)
  max: 5,
  message: {
    message: "Bạn đã hết lượt dùng thử trong tuần này. Vui lòng đăng ký để sử dụng không giới hạn.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const checkUsageLimit = async (req: Request, res: Response, next: NextFunction) => {
  // Nếu là khách -> dùng IP limiter
  if (!req.user) {
    return guestLimiter(req, res, next);
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

    const type = (req as any).mediaType as 'image' | 'video';
    if (!type) return next(new BadRequestError("Không thể xác định loại media."));

    if (dbUser.role === "user") {
      if (type === "image" && dbUser.photoUploadsThisWeek >= LIMITS.user.image) {
        return next(new TooMuchReqError(`Bạn đã đạt giới hạn ${LIMITS.user.image} ảnh/tuần.`));
      }
      if (type === "video" && dbUser.videoUploadsThisWeek >= LIMITS.user.video) {
        return next(new TooMuchReqError(`Bạn đã đạt giới hạn ${LIMITS.user.video} video/tuần.`));
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};