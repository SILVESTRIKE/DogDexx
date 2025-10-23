import { Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { UserModel } from "../models/user.model";
import { PlanModel } from "../models/plan.model";
import { BadRequestError, TooMuchReqError, PaymentRequiredError } from "../errors";
import { logger } from "../utils/logger.util";

const ONE_WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

// Cache plans để tránh query DB liên tục
let plansCache: Map<string, any> | null = null;

async function getPlans() {
  if (!plansCache) {
    const plansFromDb = await PlanModel.find({ isDeleted: false });
    plansCache = new Map(plansFromDb.map(p => [p.slug, p.toObject()]));
    logger.info("Plans cache populated.");
  }
  return plansCache;
}

// Limiter cho Guest: 5 lần/tuần/IP
const guestLimiter = rateLimit({
  windowMs: 7 * 24 * 60 * 60 * 1000, // 7 ngày (1 tuần)
  max: 5,
  message: {
    message: "Bạn đã hết lượt dùng thử trong tuần này. Vui lòng đăng ký để sử dụng không giới hạn.",
  },
  keyGenerator: (req: Request): string => {
    // SỬA LỖI: Ưu tiên fingerprint, nếu không có thì dùng req.ip.
    // express-rate-limit sẽ tự động xử lý IPv6 một cách an toàn khi key là địa chỉ IP.
    // Thêm fallback 'unknown' để đảm bảo hàm luôn trả về một string.
    return req.fingerprint?.hash || (req.ip ? ipKeyGenerator(req.ip) : 'unknown');
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const checkUsageLimit = async (req: Request, res: Response, next: NextFunction) => {
  // Nếu là khách -> dùng IP limiter
  if (!req.user) {
    return guestLimiter(req, res, next);
  }

  // Nếu là người dùng đã đăng nhập -> kiểm tra DB và plan
  try {
    const dbUser = await UserModel.findById(req.user._id);
    if (!dbUser) return next(new BadRequestError("Người dùng không hợp lệ."));
    if (dbUser.role === "admin") return next();

    const plans = await getPlans();
    const userPlan = plans.get(dbUser.plan);

    if (!userPlan) {
      logger.error(`User ${dbUser._id} has an invalid plan: '${dbUser.plan}'. Defaulting to free plan limits.`);
      // Fallback to a default limit if plan is somehow invalid
      const freePlan = plans.get('free');
      if (!freePlan) return next(new BadRequestError("Cannot determine usage limits. Free plan not found."));
      Object.assign(dbUser, freePlan); // Use free plan limits
    }

    // Reset giới hạn hàng tuần
    const now = new Date();
    if (now.getTime() - (dbUser.lastUsageResetAt?.getTime() || 0) > ONE_WEEK_IN_MS) {
      dbUser.photoUploadsThisWeek = 0;
      dbUser.videoUploadsThisWeek = 0;
      dbUser.lastUsageResetAt = now;
      // Không cần await ở đây, có thể chạy ngầm
      dbUser.save().catch(err => logger.error(`Failed to save user usage reset for ${dbUser._id}`, err));
    }

    const type = (req as any).mediaType as 'image' | 'video';
    if (!type) return next(new BadRequestError("Không thể xác định loại media."));

    // Kiểm tra giới hạn ảnh/video
    if (type === "image" && dbUser.photoUploadsThisWeek >= userPlan.imageLimit) {
      return next(new PaymentRequiredError(`Bạn đã đạt giới hạn ${userPlan.imageLimit} ảnh/tuần của gói ${userPlan.name}. Vui lòng nâng cấp.`));
    }
    if (type === "video" && dbUser.videoUploadsThisWeek >= userPlan.videoLimit) {
      return next(new PaymentRequiredError(`Bạn đã đạt giới hạn ${userPlan.videoLimit} video/tuần của gói ${userPlan.name}. Vui lòng nâng cấp.`));
    }

    // Kiểm tra giới hạn dung lượng lưu trữ
    const fileSize = req.file?.size || (req.files as Express.Multer.File[])?.reduce((sum, f) => sum + f.size, 0) || 0;
    if (fileSize > 0 && userPlan.storageLimitGB !== -1) { // -1 là không giới hạn
      const storageLimitBytes = userPlan.storageLimitGB * 1024 * 1024 * 1024;
      if (dbUser.storageUsedBytes + fileSize > storageLimitBytes) {
        return next(new PaymentRequiredError(`Tải lên sẽ vượt quá giới hạn ${userPlan.storageLimitGB}GB dung lượng của bạn. Vui lòng nâng cấp hoặc xóa bớt file.`));
      }
    }

    next();
  } catch (error) {
    if (error instanceof PaymentRequiredError) {
      return next(error);
    }
    next(error);
  }
};

/**
 * Tăng bộ đếm sử dụng cho người dùng đã đăng nhập.
 * Hàm này nên được gọi SAU KHI một tác vụ tốn tài nguyên (như dự đoán) hoàn tất.
 */
export const incrementUsage = async (req: Request) => {
  if (!req.user || req.user.role === 'admin') {
    return; // Bỏ qua nếu là khách hoặc admin
  }

  const type = (req as any).mediaType as 'image' | 'video';
  if (!type) return;

  const fileSize = req.file?.size || (req.files as Express.Multer.File[])?.reduce((sum, f) => sum + f.size, 0) || 0;

  const updateField = type === 'image' ? 'photoUploadsThisWeek' : 'videoUploadsThisWeek';
  await UserModel.updateOne(
    { _id: req.user._id },
    { $inc: { [updateField]: 1, storageUsedBytes: fileSize } }
  );
};