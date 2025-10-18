import { Request, Response } from "express";
import { predictionService } from "../services/prediction.service";
import { wikiService } from "../services/dogs_wiki.service";
import { BadRequestError } from "../errors";
import { transformMediaURLs } from "../utils/media.util";
import { feedbackService } from "../services/feedback.service";
import { DogBreedWikiDoc } from "../models/dogs_wiki.model";
import { PredictionHistoryDoc } from "../models/prediction_history.model";
import { collectionService } from "../services/user_collections.service";
import { achievementService } from "../services/achievement.service";
import { UserCollectionModel } from "../models/user_collection.model";

/**
 * Hàm phụ trợ để xử lý logic chung cho việc dự đoán và làm giàu dữ liệu.
 */
async function handlePredictionAndEnrichment(req: Request, predictionPromise: Promise<PredictionHistoryDoc>, userId?: string) {
  // 1. Chờ kết quả dự đoán từ service lõi
  const predictionResult = await predictionPromise;

  // 2. Trích xuất các slug giống chó duy nhất từ kết quả
  const breedSlugs: string[] = [...new Set(predictionResult.predictions.map((p) => p.class.toLowerCase().replace(/\s+/g, '-')))];
  
  let wikiInfoMap = new Map<string, DogBreedWikiDoc>();
  // Chỉ gọi service nếu có slug để làm giàu dữ liệu
  if (breedSlugs.length > 0) {
    const breeds = await wikiService.getBreedsBySlugs(breedSlugs);
    breeds.forEach(breed => wikiInfoMap.set(breed.slug, breed));
  }

  // 3. Nếu user đăng nhập, cập nhật collection và kiểm tra achievement
  let collectionStatus: any = null;
  if (userId && breedSlugs.length > 0) {
    const mongoose = require('mongoose');
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const oldCollection = await UserCollectionModel.find({ user_id: userObjectId }).lean();
    const oldCollectionSize = oldCollection.length;

    // Thêm tất cả giống chó mới vào bộ sưu tập
  await collectionService.addOrUpdateManyCollections(userObjectId, breedSlugs);

    const newCollections = await UserCollectionModel.find({ user_id: userObjectId });
    const newCollectionSize = newCollections.length;

    const achievementsResult = await achievementService.getUserAchievements(userId, newCollections);
    const unlockedAchievements = achievementsResult.filter(ach => ach.unlocked);

    collectionStatus = {
      isNewBreed: newCollectionSize > oldCollectionSize,
      totalCollected: newCollectionSize,
      achievementsUnlocked: unlockedAchievements.map(ach => ach.key)
    };
  }

  // 4. Lấy dự đoán có confidence cao nhất để làm thông tin chính
  const primaryPrediction = predictionResult.predictions.reduce((prev, current) => (prev.confidence > current.confidence) ? prev : current, predictionResult.predictions[0]);
  const primaryBreedSlug = primaryPrediction.class.toLowerCase().replace(/\s+/g, '-');
  const primaryBreedInfo = wikiInfoMap.get(primaryBreedSlug);

  // 5. Chuyển đổi URL media
  const transformedPrediction = transformMediaURLs(req, predictionResult.toObject());

  // 6. Xây dựng response cuối cùng theo yêu cầu của UI
  const finalResponse = {
    predictionId: transformedPrediction._id,
    detectedBreed: primaryBreedSlug,
    confidence: primaryPrediction.confidence,
    boundingBoxes: transformedPrediction.predictions.map((p: any) => ({
      x: p.box[0],
      y: p.box[1],
      width: p.box[2] - p.box[0],
      height: p.box[3] - p.box[1],
      breed: p.class.toLowerCase().replace(/\s+/g, '-')
    })),
    processedImageUrl: transformedPrediction.processedMediaPath,
    breedInfo: primaryBreedInfo ? {
      name: primaryBreedInfo.display_name,
      slug: primaryBreedInfo.slug,
      origin: (primaryBreedInfo as any).origin, // Cần thêm trường origin vào model
      group: primaryBreedInfo.group,
    } : null,
    collectionStatus: collectionStatus
  };

  return finalResponse;
}

export const bffPredictionController = {
  predictImage: async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const file = req.file;
    if (!file) throw new BadRequestError("Không có file nào được cung cấp.");

    const predictionPromise = predictionService.makePrediction(userId, file, "image", req);
    const data = await handlePredictionAndEnrichment(req, predictionPromise, userId?.toString());
    res.status(200).json(data);
  },

  predictVideo: async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const file = req.file;
    if (!file) throw new BadRequestError("Không có file nào được cung cấp.");

    const predictionPromise = predictionService.makePrediction(userId, file, "video", req);
    const data = await handlePredictionAndEnrichment(req, predictionPromise, userId?.toString());
    res.status(200).json(data);
  },

  predictBatch: async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new BadRequestError("Không có file nào được cung cấp.");
    }

    // 1. Call core batch prediction service
    const batchPredictionResults = await predictionService.makeBatchPredictions(userId, files, req);

    // 2. Collect all unique slugs and prepare for enrichment
    const allSlugs = batchPredictionResults.flatMap(result =>
      result.predictions.map(p => p.class.toLowerCase().replace(/\s+/g, '-'))
    );
    const uniqueSlugs: string[] = [...new Set(allSlugs)];

    // 3. Enrich data in parallel
    let wikiInfoMap = new Map<string, DogBreedWikiDoc>();
    let collectionStatus: any = null;

    const enrichmentPromises: Promise<any>[] = [
      wikiService.getBreedsBySlugs(uniqueSlugs).then(breeds => {
        breeds.forEach(breed => wikiInfoMap.set(breed.slug, breed));
      })
    ];

    if (userId && uniqueSlugs.length > 0) {
      const mongoose = require('mongoose');
      const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
      enrichmentPromises.push(
        (async () => {
          const oldCollectionSize = await UserCollectionModel.countDocuments({ user_id: userObjectId });
          await collectionService.addOrUpdateManyCollections(userObjectId, uniqueSlugs);
          const newCollections = await UserCollectionModel.find({ user_id: userObjectId });
          const newCollectionSize = newCollections.length;
          const achievementsResult = await achievementService.getUserAchievements(userId.toString(), newCollections);
          const unlockedAchievements = achievementsResult.filter(ach => ach.unlocked);
          collectionStatus = {
            isNewBreed: newCollectionSize > oldCollectionSize,
            totalCollected: newCollectionSize,
            achievementsUnlocked: unlockedAchievements.map(ach => ach.key)
          };
        })()
      );
    }

    await Promise.all(enrichmentPromises);
    
    // 4. Map final results
    const results = batchPredictionResults.map(predictionResult => {
      const primaryPrediction = predictionResult.predictions.reduce((prev, current) => (prev.confidence > current.confidence) ? prev : current, predictionResult.predictions[0]);
      const primaryBreedSlug = primaryPrediction.class.toLowerCase().replace(/\s+/g, '-');
      const primaryBreedInfo = wikiInfoMap.get(primaryBreedSlug);
      const transformedPrediction = transformMediaURLs(req, predictionResult.toObject());

      return {
        predictionId: transformedPrediction._id,
        originalFilename: (transformedPrediction.media as any)?.name || 'unknown',
        detectedBreed: primaryBreedSlug,
        confidence: primaryPrediction.confidence,
        boundingBoxes: transformedPrediction.predictions.map((p: any) => ({
          x: p.box[0], y: p.box[1], width: p.box[2] - p.box[0], height: p.box[3] - p.box[1],
          breed: p.class.toLowerCase().replace(/\s+/g, '-')
        })),
        processedMediaUrl: transformedPrediction.processedMediaPath,
        // Trả về thông tin cho TẤT CẢ các breed được nhận dạng trong ảnh này
        detectedBreeds: [...new Set(predictionResult.predictions.map(p => p.class.toLowerCase().replace(/\s+/g, '-')))].map(slug => {
            const breedInfo = wikiInfoMap.get(slug);
            return breedInfo ? {
                name: breedInfo.display_name,
                slug: breedInfo.slug,
                origin: (breedInfo as any).origin,
                group: breedInfo.group,
            } : null;
        }).filter(b => b !== null),

        // Collection status is shared across the batch
        collectionStatus: collectionStatus 
      };
    });

    res.status(200).json(results);
  },

  submitFeedback: async (req: Request, res: Response) => {
    const userId = req.user?._id; // Can be optional
    const predictionId = req.params.id;
    const { isCorrect, correctBreed, notes } = req.body;

    const mongoose = require('mongoose');
    let userObjectId: any = undefined;
    if (userId) {
      userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    }
  const result = await feedbackService.submitFeedback(userObjectId, { predictionId, isCorrect, submittedLabel: correctBreed, notes });
    
    // Logic to check if this is a new breed alert can be added here or in the service
    const newBreedAlert = !isCorrect && correctBreed; // Simplified logic

    res.status(201).json({ feedbackId: (result as any)._id, message: 'Feedback submitted successfully', newBreedAlert });
  },

  getPredictionHistory: async (req: Request, res: Response) => {
    // This endpoint is now less critical as profile endpoint can aggregate this.
    // However, if a dedicated history page is needed, we can implement it here.
    // For now, we can point to the existing core service.
    const { getHistoryForCurrentUser } = require('../controllers/prediction_history.controller');
    return getHistoryForCurrentUser(req, res);
  }
};
