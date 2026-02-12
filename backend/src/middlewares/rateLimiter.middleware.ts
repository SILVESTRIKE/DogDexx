import { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redisClient } from "../utils/redis.util";
import { UserDoc } from "../models/user.model";

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests / window
  standardHeaders: true,
  legacyHeaders: false,

  store: redisClient
    ? new RedisStore({
        sendCommand: (...args: string[]) =>
          redisClient!.sendCommand(args),
        prefix: "rate_limit:",
      })
    : undefined,

  keyGenerator: (req: Request): string => {
    return (
      req.fingerprint?.hash ||
      (ipKeyGenerator as unknown as (req: Request) => string)(req)
    );
  },

  skip: (req: Request): boolean => {
    const user = (req as any).user as UserDoc | undefined;

    // Skip admin
    if (user?.role === "admin") return true;

    // Skip prediction status polling
    if (
      req.path.includes("/predictions") &&
      req.path.includes("/status") &&
      req.method === "GET"
    ) {
      return true;
    }

    // Whitelist localhost (load test)
    if (req.ip === "::1" || req.ip === "127.0.0.1") {
      return true;
    }

    return false;
  },

  handler: (req, res, _next, options) => {
    res.status(options.statusCode || 429).json({
      success: false,
      errors: [
        {
          message:
            "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.",
          field: "rate_limit",
        },
      ],
    });
  },
});
