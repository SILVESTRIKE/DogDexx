import { Request, Response, NextFunction } from "express";
import { predictionService } from "../services/prediction.service";
import { BadRequestError } from "../errors";
import { transformMediaURLs } from "../utils/media.util";

export const predictionController = {
  getPredictionStatus: async (req: Request, res: Response) => {
    const { predictionId } = req.params;
    const status = await predictionService.getPredictionStatus(predictionId);
    res.json(status);
  },
  predict: async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const files = req.files as Express.Multer.File[];
    const file = req.file;
    const mediaType = (req as any).mediaType as "image" | "video";

    // Handle batch prediction if multiple files are uploaded
    /*
    if (Array.isArray(files) && files.length > 0) {
      if (mediaType === "video") {
        throw new BadRequestError("Batch processing không được hỗ trợ cho video.");
      }
      
      const results = await predictionService.makeBatchPredictions(userId, files, req);
      const responseData = await Promise.all(
        results.map(async (result) => {
          const populatedResult = await result.toObject();
          return transformMediaURLs(req, populatedResult);
        })
      );

      return res.status(200).json({
        message: "Dự đoán batch images thành công.",
        data: responseData,
      });
    }
    */

    // Handle single file prediction
    if (!file) {
      throw new BadRequestError("Không có file nào được cung cấp.");
    }

    const result = await predictionService.makePrediction(userId, file, mediaType, req);
    const populatedResult = await result.toObject();
    const responseData = populatedResult ? transformMediaURLs(req, populatedResult) : null;

    res.status(200).json({
      message: `Dự đoán ${mediaType} thành công.`,
      data: responseData,
    });
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

