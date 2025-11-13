import { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { TooMuchReqError } from "../errors";
import { UserDoc } from "../models/user.model";

export const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 500, // Giới hạn mỗi IP/user là 500 yêu cầu mỗi giờ
  standardHeaders: true, // Trả về thông tin rate limit trong header `RateLimit-*`
  legacyHeaders: false, // Tắt các header `X-RateLimit-*` cũ

  keyGenerator: (req: Request): string => {
    // SỬA LỖI: Ưu tiên fingerprint, nếu không có thì dùng req.ip.
    // express-rate-limit sẽ tự động xử lý IPv6 một cách an toàn khi key là địa chỉ IP.
    // Thêm fallback 'unknown' để đảm bảo hàm luôn trả về một string.
    return req.fingerprint?.hash || (req.ip ? ipKeyGenerator(req.ip) : 'unknown');
  },

  skip: (req: Request): boolean => {
    const user = (req as any).user as UserDoc | undefined;
    return user?.role === 'admin';
  },

  handler: (req, res, next) => {
    next(new TooMuchReqError("Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 giờ."));
  },
});