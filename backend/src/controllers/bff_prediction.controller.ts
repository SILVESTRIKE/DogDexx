import { Request, Response } from "express";
import { predictionService } from "../services/prediction.service";
import { wikiService } from "../services/dogs_wiki.service";
import { BadRequestError } from "../errors";
import { transformMediaURLs } from "../utils/media.util";
import { feedbackService } from "../services/feedback.service";

export const bffPredictionController = {
  predictImage: async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const file = req.file;
    if (!file) {
      throw new BadRequestError("Không có file nào được cung cấp.");
    }

    // 1. Call core prediction service
    const predictionResult = await predictionService.makePrediction(userId, file, "image", req);

    // 2. Enrich data
    const breedSlugs = [...new Set(predictionResult.predictions.map(p => p.class.toLowerCase().replace(/\s+/g, '-')))];
    const enrichedBreeds = await wikiService.getBreedsBySlugs(breedSlugs);

    // 3. Transform URLs
    const responseData = transformMediaURLs(req, predictionResult.toObject());

    // 4. Send aggregated response
    res.status(200).json({
      message: "Dự đoán ảnh thành công.",
      data: {
        prediction: responseData,
        enrichedBreeds: enrichedBreeds,
      }
    });
  },

  predictVideo: async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const file = req.file;
    if (!file) {
      throw new BadRequestError("Không có file nào được cung cấp.");
    }

    // 1. Call core prediction service
    const predictionResult = await predictionService.makePrediction(userId, file, "video", req);

    // 2. Enrich data
    const breedSlugs = [...new Set(predictionResult.predictions.map(p => p.class.toLowerCase().replace(/\s+/g, '-')))];
    const enrichedBreeds = await wikiService.getBreedsBySlugs(breedSlugs);

    // 3. Transform URLs
    const responseData = transformMediaURLs(req, predictionResult.toObject());

    // 4. Send aggregated response
    res.status(200).json({
      message: "Dự đoán video thành công.",
      data: {
        prediction: responseData,
        enrichedBreeds: enrichedBreeds,
      }
    });
  },

  predictBatch: async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new BadRequestError("Không có file nào được cung cấp.");
    }

    // 1. Call core batch prediction service
    const batchResults = await predictionService.makeBatchPredictions(userId, files, req);

    // 2. Collect all unique slugs from all results
    const allSlugs = batchResults.flatMap(result =>
      result.predictions.map(p => p.class.toLowerCase().replace(/\s+/g, '-'))
    );
    const uniqueSlugs = [...new Set(allSlugs)];

    // 3. Enrich data once for all unique slugs
    const enrichedBreeds = await wikiService.getBreedsBySlugs(uniqueSlugs);

    // 4. Transform URLs for each result
    const responseData = batchResults.map(result => transformMediaURLs(req, result.toObject()));

    // 5. Send aggregated response
    res.status(200).json({
      message: "Dự đoán batch thành công.",
      data: {
        predictions: responseData,
        enrichedBreeds: enrichedBreeds,
      }
    });
  },

  // Note: The WebSocket endpoint for streaming is handled separately by a proxy/handler

  submitFeedback: async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const predictionId = req.params.id;
    const result = await feedbackService.submitFeedback(userId, { ...req.body, predictionId });
    res.status(201).json({ message: 'Cảm ơn bạn đã gửi phản hồi!', data: result });
  },

  getPredictionHistory: async (req: Request, res: Response) => {
    // This endpoint is now less critical as profile endpoint can aggregate this.
    // However, if a dedicated history page is needed, we can implement it here.
    // For now, we can point to the existing core service.
    const { getHistoryForCurrentUser } = require('../controllers/prediction_history.controller');
    return getHistoryForCurrentUser(req, res);
  }
};
