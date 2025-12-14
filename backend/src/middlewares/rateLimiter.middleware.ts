import { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req: Request): string => {
    return (req.fingerprint?.hash || (ipKeyGenerator as unknown as (req: Request) => string)(req));
  },

  skip: (req: Request): boolean => {
    const user = (req as any).user;
    // Skip rate limiting for prediction status polling
    if (req.path.includes('/predictions') && req.path.includes('/status') && req.method === 'GET') {
      return true;
    }
    return user?.role === "admin";
  },

  handler: (req, res, next, options) => {
    res.status(options.statusCode || 429).json({
      success: false,
      errors: [{ message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 5 phút.", field: "rate_limit", },],
    });
  },
});