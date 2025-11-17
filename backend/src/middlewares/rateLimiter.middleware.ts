import { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { TooMuchReqError } from "../errors";
import { UserDoc } from "../models/user.model";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Giới hạn mỗi IP/user là 100 yêu cầu mỗi 15 phút
  standardHeaders: true, // Trả về thông tin rate limit trong header `RateLimit-*`
  legacyHeaders: false, // Tắt các header `X-RateLimit-*` cũ

  keyGenerator: (req: Request): string => {
    // Ưu tiên fingerprint. Nếu không có, sử dụng ipKeyGenerator để lấy key từ IP.
    // ipKeyGenerator(req) sẽ xử lý đúng cả IPv4 và IPv6.
    return req.fingerprint?.hash || (ipKeyGenerator as unknown as (req: Request) => string)(req);
  },

  skip: (req: Request): boolean => {
    const user = (req as any).user as UserDoc | undefined;
    return user?.role === 'admin';
  },

  handler: (req, res, next) => {
    next(new TooMuchReqError("Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút."));
  },
});