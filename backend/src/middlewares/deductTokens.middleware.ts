import { Request, Response } from "express";
import { UserModel } from "../models/user.model";
import { redisClient } from "../utils/redis.util";
import { logger } from "../utils/logger.util";
import { tokenConfig } from "../config/token.config";
import { UserDoc } from "../models/user.model";
/**
 * Hàm trừ token cho MỘT REQUEST, tự động xác định là user hay guest.
 * SAU KHI TRỪ, NÓ SẼ ĐẶT HEADER VÀO RESPONSE.
 * @param req - Đối tượng Request
 * @param tokenCost - Chi phí token cơ bản
 * @param type - Loại chi phí ('single' hoặc 'batch')
 */
export const deductTokensForRequest = async (
  req: Request,
  res: Response,
  tokenCost: number,
  type: "single" | "batch" | "stream" = "single"
) => {
  const user = (req as any).user as UserDoc | undefined;
  if (user?.role === "admin") {
    return;
  }
  let actualCost: number;
  if (type === "batch") {
    actualCost =
      tokenCost * ((req.files as Express.Multer.File[])?.length || 1);
  } else {
    actualCost = tokenCost;
  }
  if (actualCost === 0) return;
  if (user) {
    try {
      const updatedUser = await UserModel.findOneAndUpdate(
        { _id: user._id, remainingTokens: { $gte: actualCost } },
        { $inc: { remainingTokens: -actualCost } },
        { new: true }
      ).exec();
      if (updatedUser) {
        res.setHeader(
          "X-User-Tokens-Remaining",
          updatedUser.remainingTokens.toString()
        );
        const originalUser = (req as any).user as UserDoc & {
          tokenAllotment: number;
        };
        res.setHeader(
          "X-User-Tokens-Limit",
          (originalUser.tokenAllotment || 0).toString()
        );
        logger.info(
          `[Token] User ${user._id} deducted ${actualCost} tokens successfully.`
        );
      } else {
        logger.warn(
          `[Token] User ${user._id} deduction of ${actualCost} tokens skipped. Insufficient funds at time of deduction or user not found.`
        );
      }
    } catch (error) {
      logger.error(
        `[Token] Failed to deduct tokens for user ${user._id}:`,
        error
      );
    }
  } else if (redisClient) {
    const identifier = (req as any).fingerprint?.hash || req.ip;
    if (identifier) {
      const key = `guest:token:${identifier}`;
      try {
        const newRemaining = await redisClient.decrBy(key, actualCost);
        res.setHeader("X-Trial-Tokens-Remaining", newRemaining.toString());
        res.setHeader(
          "X-Trial-Tokens-Limit",
          tokenConfig.guest.initialTokens.toString()
        );
        await redisClient.expire(key, tokenConfig.guest.expirationSeconds);
        logger.info(
          `[Token] Guest ${identifier} deducted ${actualCost} tokens. Remaining: ${newRemaining}.`
        );
      } catch (error) {
        logger.error(
          `[Token] Failed to deduct tokens for guest ${identifier} in Redis:`,
          error
        );
      }
    }
  }
};