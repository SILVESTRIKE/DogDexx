import { Request, Response, NextFunction } from "express";
import {
  PaymentRequiredError,
  TooMuchReqError,
  BadRequestError,
} from "../errors";
import { redisClient } from "../utils/redis.util";
import { tokenConfig } from "../config/token.config";
import { UserDoc } from "../models/user.model";
import { logger } from "../utils/logger.util";

export const checkTokenLimit = (
  tokenCost: number,
  type: "single" | "batch" = "single"
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const actualCost =
      type === "batch"
        ? tokenCost * ((req.files as Express.Multer.File[])?.length || 1)
        : tokenCost;

    if ((req as any).user) {
      const user = (req as any).user as UserDoc & { tokenAllotment: number };

      if (user.role === "admin") {
        logger.info(`[TokenCheck] Admin user ${user._id} skipped token check.`);
        return next();
      }

      if (user.remainingTokens < actualCost) {
        logger.warn(
          `[TokenCheck] User ${user._id} has insufficient tokens. Required: ${actualCost}, Remaining: ${user.remainingTokens}.`
        );
        return next(
          new PaymentRequiredError(
            `Bạn không đủ token. Cần ${actualCost}, còn lại ${user.remainingTokens}.`
          )
        );
      }

      return next();
    }

    if (!redisClient) {
      return next(
        new BadRequestError("Dịch vụ đang gặp sự cố, vui lòng thử lại sau.")
      );
    }

    const identifier = (req as any).fingerprint?.hash || req.ip;
    if (!identifier) {
      return next(new TooMuchReqError("Không thể xác định danh tính của bạn."));
    }
    const key = `guest:token:${identifier}`;

    try {
      let currentTokensStr = await redisClient.get(key);
      let remainingTokens: number;

      if (currentTokensStr === null) {
        remainingTokens = tokenConfig.guest.initialTokens;
        await redisClient.set(key, remainingTokens, {
          EX: tokenConfig.guest.expirationSeconds,
        });
      } else {
        remainingTokens = parseInt(currentTokensStr, 10);
      }

      if (remainingTokens < actualCost) {
        logger.warn(
          `[TokenCheck] Guest ${identifier} has insufficient tokens. Required: ${actualCost}, Remaining: ${remainingTokens}.`
        );
        return next(
          new TooMuchReqError(
            `Bạn đã hết lượt dùng thử. Vui lòng đăng ký để sử dụng không giới hạn.`
          )
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
