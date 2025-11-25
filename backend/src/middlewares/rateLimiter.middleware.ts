import { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { TooMuchReqError } from "../errors";
import { UserDoc } from "../models/user.model";
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return (
      req.fingerprint?.hash ||
      (ipKeyGenerator as unknown as (req: Request) => string)(req)
    );
  },
  skip: (req: Request): boolean => {
    const user = (req as any).user as UserDoc | undefined;
    return user?.role === "admin";
  },
  handler: (req, res, next) => {
    next(
      new TooMuchReqError(
        "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút."
      )
    );
  },
});
