import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { predictionService } from "../services/prediction.service";
import { BadRequestError } from "../errors";
import { transformMediaURLs } from "../utils/media.util";
import { logger } from "../utils/logger.util";
import { redisClient } from "../utils/redis.util"; // Import Redis
import { REDIS_KEYS } from "../constants/redis.constants";

export const predictionController = {
  getPredictionStatus: async (req: Request, res: Response) => {
    const { predictionId } = req.params;
    const status = await predictionService.getPredictionStatus(predictionId);
    res.json(status);
  },
  predict: async (req: Request, res: Response) => {
    const startTime = Date.now();
    const userId = req.user?._id;
    const files = req.files as Express.Multer.File[];
    const file = req.file;
    const mediaType = (req as any).mediaType as "image" | "video";

    // 0. LOCKING KEY (Rate Limit per User)
    let lockKey = '';
    if (userId) {
      lockKey = `predict:lock:user:${userId}`;
    } else {
      // Fallback to IP if generic (though predict usually requires auth or guest token)
      const ip = req.ip || req.socket.remoteAddress;
      lockKey = `predict:lock:ip:${ip}`;
    }

    if (redisClient) {
      // Try to acquire lock for 10 seconds (max prediction time assumption)
      const acquired = await redisClient.set(lockKey, 'processing', { NX: true, EX: 10 });
      if (!acquired) {
        throw new BadRequestError("Hệ thống đang xử lý yêu cầu trước đó của bạn. Vui lòng đợi.");
      }
    }

    try {
      // Handle single file prediction
      if (!file) {
        throw new BadRequestError("Không có file nào được cung cấp.");
      }

      // Call service - now returns immediate result { predictions, processed_base64 }
      const result = await predictionService.makePrediction(userId, file, mediaType, req);

      const responseData = transformMediaURLs(req, result);

      const duration = Date.now() - startTime;
      logger.info(`[PERF] CONTROLLER | Total: ${duration}ms`);

      res.status(200).json({
        message: `Dự đoán ${mediaType} thành công.`,
        data: responseData,
      });
    } finally {
      // ALWAYS Release Lock
      if (redisClient) {
        await redisClient.del(lockKey);
      }
    }
  },

  saveStreamResult: async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const result = await predictionService.saveStreamPrediction(userId, req.body, req);
    const populatedResult = await result.toObject();
    const responseData = populatedResult ? transformMediaURLs(req, populatedResult) : null;

    res.status(201).json({
      message: "Lưu kết quả stream thành công.",
      data: responseData,
    });
  },
};
