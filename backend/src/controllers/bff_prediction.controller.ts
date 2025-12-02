import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import WebSocket from "ws";
import { Types } from "mongoose";
import { predictionService } from "../services/prediction.service";
import { wikiService } from "../services/dogs_wiki.service";
import { BadRequestError, NotFoundError } from "../errors";
import { transformMediaURLs } from "../utils/media.util";
import { feedbackService } from "../services/feedback.service";
import { collectionService } from "../services/user_collections.service";
import { achievementService } from "../services/achievement.service";
import { userService } from "../services/user.service";
import { logger } from "../utils/logger.util";
import { predictionHistoryService } from "../services/prediction_history.service";
import {
  askGemini,
  getChatHistory as getGeminiChatHistory,
} from "../services/geminiAI.service";
import { redisClient } from "../utils/redis.util";
import { REDIS_KEYS } from "../constants/redis.constants";
import { tokenConfig } from "../config/token.config";
import {
  getHealthRecommendations,
  getRecommendedProducts,
} from "../services/geminiAI.service";
import { deductTokensForRequest } from "../middlewares/deductTokens.middleware";
import { DogBreedWikiDoc } from "../models/dogs_wiki.model";
import { PREDICTION_SOURCES } from "../constants/prediction.constants";
import { UserDoc, UnlockedAchievement } from "../models/user.model";
interface PredictionItem {
  class: string;
  confidence: number;
  box: number[];
}
function createEnrichedBreedInfo(
  breedInfoDoc: DogBreedWikiDoc | null | undefined
) {
  if (!breedInfoDoc) return null;
  return {
    breed: breedInfoDoc.breed,
    slug: breedInfoDoc.slug,
    group: breedInfoDoc.group,
    description: breedInfoDoc.description,
    life_expectancy: breedInfoDoc.life_expectancy,
    temperament: breedInfoDoc.temperament,
    energy_level: breedInfoDoc.energy_level,
    trainability: breedInfoDoc.trainability,
    shedding_level: breedInfoDoc.shedding_level,
    maintenance_difficulty: breedInfoDoc.maintenance_difficulty,
    height: breedInfoDoc.height,
    weight: breedInfoDoc.weight,
    good_with_children: breedInfoDoc.good_with_children,
    suitable_for: breedInfoDoc.suitable_for,
  };
}
async function updateUserCollectionAndAchievements(
  userId: string,
  breedSlugs: string[],
  predictionId: Types.ObjectId,
  req: Request
) {
  if (!userId || breedSlugs.length === 0) return null;
  const lang =
    req.headers["accept-language"]?.split(",")[0].toLowerCase() === "vi"
      ? "vi"
      : "en";
  const userObjectId = new Types.ObjectId(userId);
  const [userBeforeUpdate, oldCollections] = await Promise.all([
    userService.getById(userId),
    collectionService.getUserCollection(userObjectId),
  ]);
  if (!userBeforeUpdate) return null;
  await collectionService.addOrUpdateManyCollections(
    userObjectId,
    breedSlugs,
    predictionId,
    lang
  );
  const [userAfterUpdate, newCollections] = await Promise.all([
    userService.getById(userId),
    collectionService.getUserCollection(userObjectId),
  ]);
  if (!userAfterUpdate) return null;
  const achievementsResult = await achievementService.processUserAchievements(
    userAfterUpdate as UserDoc,
    newCollections,
    lang
  );
  const unlockedAchievements = (achievementsResult as any[]).filter(
    (ach) =>
      ach.unlocked &&
      !(userBeforeUpdate.achievements || []).some(
        (oldAch: UnlockedAchievement) => oldAch.key === ach.key
      )
  );
  return {
    isNewBreed: newCollections.length > oldCollections.length,
    totalCollected: newCollections.length,
    achievementsUnlocked: unlockedAchievements.map(
      (ach) => ach.key
    ) as string[],
  };
}
async function handlePredictionAndEnrichment(
  req: Request,
  predictionPromise: Promise<any>,
  source: (typeof PREDICTION_SOURCES)[keyof typeof PREDICTION_SOURCES],
  userId?: string
) {
  const lang =
    req.headers["accept-language"]?.split(",")[0].toLowerCase() === "vi"
      ? "vi"
      : "en";
  const predictionResult = await predictionPromise;
  if (!predictionResult)
    throw new NotFoundError("Prediction result could not be created or found.");
  const predictionsArray: PredictionItem[] = Array.isArray(
    predictionResult.predictions
  )
    ? predictionResult.predictions
    : [];
  const allSlugs: string[] = [
    ...new Set(
      predictionsArray.map((p: PredictionItem) =>
        p.class.toLowerCase().replace(/\s+/g, "-")
      )
    ),
  ];
  let wikiInfoMap = new Map<string, DogBreedWikiDoc>();
  if (allSlugs.length > 0) {
    const breeds = await wikiService.getBreedsBySlugs(allSlugs, lang);
    breeds.forEach((breed) => wikiInfoMap.set(breed.slug, breed));
  }
  const detections = predictionsArray.map((p: any) => {
    const slug = p.class.toLowerCase().replace(/\s+/g, "-");
    const breedInfoDoc = wikiInfoMap.get(slug);
    let finalBreedInfo;
    if (breedInfoDoc) {
      finalBreedInfo = createEnrichedBreedInfo(breedInfoDoc);
    } else {
      finalBreedInfo = {
        breed: p.class.toUpperCase(),
        slug: slug,
        group: "Object / Other",
        description:
          lang === "vi"
            ? `Hệ thống nhận diện đây là __STRING_1_40__. Đây không phải là một giống chó trong cơ sở dữ liệu.`
            : `System identified this as __STRING_1_41__. This is not a dog breed in our database.`,
        life_expectancy: "N/A",
        temperament: ["Non-Dog"],
        energy_level: null,
        trainability: null,
        shedding_level: null,
        maintenance_difficulty: null,
        height: "N/A",
        weight: "N/A",
        good_with_children: null,
        suitable_for: [],
      };
    }
    return {
      detectedBreed: slug,
      confidence: p.confidence,
      boundingBox: {
        x: p.box[0],
        y: p.box[1],
        width: p.box[2] - p.box[0],
        height: p.box[3] - p.box[1],
      },
      breedInfo: finalBreedInfo,
    };
  });
  let collectionStatus = null;
  if (userId) {
    const validDogSlugs = allSlugs.filter((slug) => wikiInfoMap.has(slug));
    if (validDogSlugs.length > 0) {
      // Handle both Mongoose document (_id) and plain object (predictionId)
      const predictionId = predictionResult._id || predictionResult.predictionId;

      if (predictionId) {
        collectionStatus = await updateUserCollectionAndAchievements(
          userId,
          validDogSlugs,
          new Types.ObjectId(predictionId.toString()),
          req
        );
      }
    }
  }
  const predictionObject = predictionResult.toObject
    ? predictionResult.toObject()
    : predictionResult;
  const transformedPrediction = transformMediaURLs(req, predictionObject);

  let processedMediaUrl = transformedPrediction.processedMediaUrl;
  if (!processedMediaUrl && predictionResult.processed_base64) {
    const isVideo = source === PREDICTION_SOURCES.VIDEO_UPLOAD;
    const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';
    processedMediaUrl = `data:${mimeType};base64,${predictionResult.processed_base64}`;
  }

  return {
    predictionId: transformedPrediction.predictionId || transformedPrediction.id,
    processedMediaUrl: processedMediaUrl,
    detections: detections,
    collectionStatus: collectionStatus,
  };
}
export const bffPredictionController = {
  predictImage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as UserDoc | undefined;
      const userId = user?._id as Types.ObjectId | undefined;
      const file = req.file;
      if (!file) throw new BadRequestError("Không có file nào được cung cấp.");
      const startTime = Date.now();
      logger.info(`[Timing] [BFF] Request received for image prediction. User: ${userId || 'Guest'}`);

      // [BẮT ĐẦU SỬA]
      const result = await predictionService.makePrediction(
        userId,
        file,
        "image",
        req
      );

      // Thêm đoạn kiểm tra này (giống predictVideo)
      if (result.status === 'processing') {
        await deductTokensForRequest(
          req,
          res,
          tokenConfig.costs.imagePrediction,
          "single"
        );

        // SỬA LẠI ĐOẠN NÀY: Bỏ lồng 'data', đưa predictionId ra ngoài
        res.status(202).json({
          predictionId: result.predictionId,
          status: 'processing',
          message: "Ảnh đang được xử lý ngầm."
        });
        return;
      }

      // Logic cũ (để dự phòng)
      const data = await handlePredictionAndEnrichment(
        req,
        Promise.resolve(result),
        PREDICTION_SOURCES.IMAGE_UPLOAD,
        userId?.toString()
      );
      // [KẾT THÚC SỬA]

      const duration = Date.now() - startTime;
      logger.info(`[PERF] BFF | Type: image | Total: ${duration}ms`);

      await deductTokensForRequest(
        req,
        res,
        tokenConfig.costs.imagePrediction,
        "single"
      );
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  },
  predictVideo: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as UserDoc | undefined;
      const userId = user?._id as Types.ObjectId | undefined;
      const file = req.file;
      if (!file) throw new BadRequestError("Không có file nào được cung cấp.");
      const startTime = Date.now();
      logger.info(`[Timing] [BFF] Request received for video prediction. User: ${userId || 'Guest'}`);

      const result = await predictionService.makePrediction(
        userId,
        file,
        "video",
        req
      );

      // Kiểm tra nếu đang xử lý ngầm (Async)
      if (result.status === 'processing') {
        await deductTokensForRequest(
          req,
          res,
          tokenConfig.costs.videoPrediction,
          "single"
        );

        res.status(202).json({
          predictionId: result.predictionId,
          status: 'processing',
          message: "Video đang được xử lý ngầm."
        });
        return;
      }

      const data = await handlePredictionAndEnrichment(
        req,
        Promise.resolve(result),
        PREDICTION_SOURCES.VIDEO_UPLOAD,
        userId?.toString()
      );

      const duration = Date.now() - startTime;
      logger.info(`[PERF] BFF | Type: video | Total: ${duration}ms`);

      await deductTokensForRequest(
        req,
        res,
        tokenConfig.costs.videoPrediction,
        "single"
      );
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  },

  predictUrl: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as UserDoc | undefined;
      const userId = user?._id as Types.ObjectId | undefined;
      const { url } = req.body;
      const startTime = Date.now();

      if (!url) throw new BadRequestError("URL không được để trống.");

      const predictionPromise = predictionService.makeUrlPrediction(
        userId,
        url,
        req
      );

      const data = await handlePredictionAndEnrichment(
        req,
        predictionPromise,
        PREDICTION_SOURCES.URL_INPUT,
        userId?.toString()
      );

      const duration = Date.now() - startTime;
      logger.info(`[PERF] BFF | Type: url | Total: ${duration}ms`);

      // Tính phí token (ví dụ: giống image prediction)
      await deductTokensForRequest(
        req,
        res,
        tokenConfig.costs.imagePrediction,
        "single"
      );

      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  },
  predictBatch: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as UserDoc | undefined;
      const userId = user?._id as Types.ObjectId | undefined;
      const lang =
        req.headers["accept-language"]?.split(",")[0].toLowerCase() === "vi"
          ? "vi"
          : "en";
      const files = req.files as Express.Multer.File[];
      const startTime = Date.now();

      if (!files || files.length === 0) {
        throw new BadRequestError("Không có file nào được cung cấp.");
      }
      const batchPredictionResults =
        await predictionService.makeBatchPredictions(userId, files, req);
      const allSlugs: string[] = batchPredictionResults.flatMap((result) =>
        result.predictions.map((p) =>
          p.class.toLowerCase().replace(/\s+/g, "-")
        )
      );
      const uniqueSlugs: string[] = [...new Set(allSlugs)];
      let wikiInfoMap = new Map<string, DogBreedWikiDoc>();
      let collectionStatus: any = null;
      const enrichmentPromises: Promise<any>[] = [
        wikiService.getBreedsBySlugs(uniqueSlugs, lang).then((breeds) => {
          breeds.forEach((breed) => wikiInfoMap.set(breed.slug, breed));
        }),
      ];
      if (userId && uniqueSlugs.length > 0) {
        enrichmentPromises.push(
          (async () => {
            const [userBeforeUpdate, oldCollections] = await Promise.all([
              userService.getById(userId.toString()),
              collectionService.getUserCollection(userId),
            ]);
            if (!userBeforeUpdate) return;
            await collectionService.addOrUpdateFromPredictionResults(
              userId,
              batchPredictionResults,
              lang
            );
            const [userAfterUpdate, newCollections] = await Promise.all([
              userService.getById(userId.toString()),
              collectionService.getUserCollection(userId),
            ]);
            if (!userAfterUpdate) return;
            const achievementsResult =
              await achievementService.processUserAchievements(
                userAfterUpdate as UserDoc,
                newCollections,
                lang
              );
            const unlockedAchievements = achievementsResult.filter(
              (ach) =>
                ach.unlocked &&
                !(userBeforeUpdate.achievements || []).some(
                  (oldAch: UnlockedAchievement) => oldAch.key === ach.key
                )
            );
            collectionStatus = {
              isNewBreed: newCollections.length > oldCollections.length,
              totalCollected: newCollections.length,
              achievementsUnlocked: unlockedAchievements.map((ach) => ach.key),
            };
          })()
        );
      }
      await Promise.all(enrichmentPromises);
      const results = batchPredictionResults.map((predictionResult) => {
        const transformedPrediction = transformMediaURLs(
          req,
          predictionResult.toObject()
        );
        const detections = transformedPrediction.predictions.map((p: any) => {
          const slug = p.class.toLowerCase().replace(/\s+/g, "-");
          const breedInfoDoc = wikiInfoMap.get(slug);
          return {
            detectedBreed: slug,
            confidence: p.confidence,
            boundingBox: {
              x: p.box[0],
              y: p.box[1],
              width: p.box[2] - p.box[0],
              height: p.box[3] - p.box[1],
            },
            breedInfo: createEnrichedBreedInfo(breedInfoDoc),
          };
        });
        return {
          predictionId: transformedPrediction.id,
          originalFilename:
            (transformedPrediction.media as any)?.name || "unknown",
          processedMediaUrl: transformedPrediction.processedMediaUrl,
          detections: detections,
          collectionStatus: collectionStatus,
        };
      });

      const duration = Date.now() - startTime;
      logger.info(`[PERF] BFF | Type: batch | Count: ${files.length} | Total: ${duration}ms`);

      await deductTokensForRequest(
        req,
        res,
        tokenConfig.costs.imagePrediction,
        "batch"
      );
      res.status(200).json(results);
    } catch (error) {
      next(error);
    }
  },
  submitFeedback: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?._id;
      const { id: prediction_id } = req.params;
      const { user_submitted_label, notes, isCorrect } = req.body;
      const predictionHistory =
        await predictionHistoryService.getHistoryByIdForUser(
          userId,
          prediction_id
        );
      if (!predictionHistory) {
        throw new NotFoundError("Không tìm thấy lịch sử dự đoán.");
      }
      const file_path = (predictionHistory.media as any)?.path;
      const feedback = await feedbackService.submitFeedback(userId, {
        prediction_id,
        isCorrect,
        user_submitted_label,
        notes,
        file_path,
      });
      res.status(201).json({
        feedbackId: feedback._id,
        message: "Feedback submitted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
  deletePredictionHistory: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = (req as any).user!._id;
      const { id: historyId } = req.params;
      const result = await predictionHistoryService.deleteHistoryForUser(
        userId,
        historyId
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
  getPredictionHistory: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = (req as any).user!._id;
      const lang =
        req.headers["accept-language"]?.split(",")[0].toLowerCase() === "vi"
          ? "vi"
          : "en";
      const { page = 1, limit = 10 } = req.query;
      const historyResult = await predictionHistoryService.getHistoryForUser(
        userId,
        {
          page: Number(page),
          limit: Number(limit),
        }
      );
      const allSlugs = [
        ...new Set(
          historyResult.histories.flatMap((h) =>
            h.predictions.map((p) => p.class.toLowerCase().replace(/\s+/g, "-"))
          )
        ),
      ];
      const wikiInfoMap = new Map<string, { breed: string }>();
      if (allSlugs.length > 0) {
        const breeds = await wikiService.getBreedsBySlugs(allSlugs, lang);
        breeds.forEach((breed) =>
          wikiInfoMap.set(breed.slug, { breed: breed.breed })
        );
      }
      const enrichedData = historyResult.histories.map((historyItem) => {
        const item = transformMediaURLs(req, historyItem.toObject());
        const detections = (item.predictions || []).map((p: any) => {
          const slug = p.class.toLowerCase().replace(/\s+/g, "-");
          const breedInfo = wikiInfoMap.get(slug);
          return {
            detectedBreed: slug,
            breedName: breedInfo?.breed || slug,
            confidence: p.confidence,
          };
        });
        return {
          id: item.id,
          processedMediaUrl: item.processedMediaUrl,
          modelUsed: item.modelUsed,
          isCorrect: item.isCorrect,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          detections: detections,
          media: {
            name: item.media?.name || "N/A",
            mediaUrl: item.media?.mediaUrl,
            type: item.media?.type,
          },
          source: item.source,
        };
      });
      res.status(200).json({
        histories: enrichedData,
        total: historyResult.total,
        page: historyResult.page,
        limit: historyResult.limit,
        totalPages: historyResult.totalPages,
      });
    } catch (error) {
      next(error);
    }
  },
  getPredictionHistoryById: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id: historyId } = req.params;
      const lang =
        req.query.lang === "vi" || req.query.lang === "en"
          ? (req.query.lang as "vi" | "en")
          : "en";
      let historyItem = null;
      let attempts = 0;
      while (attempts < 10 && !historyItem) {
        try {
          historyItem = await predictionHistoryService.getHistoryById(historyId);
        } catch (error) {
          // Ignore error and retry if not found
        }
        if (!historyItem) {
          attempts++;
          if (attempts < 10) await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      if (!historyItem)
        throw new NotFoundError("Prediction history not found.");
      const breedSlugs: string[] = [
        ...new Set(
          historyItem.predictions.map((p: any) =>
            p.class.toLowerCase().replace(/\s+/g, "-")
          )
        ),
      ];
      const breeds = await wikiService.getBreedsBySlugs(breedSlugs, lang);
      let wikiInfoMap = new Map();
      try {
        const breeds = await wikiService.getBreedsBySlugs(breedSlugs, lang);
        wikiInfoMap = new Map(breeds.map((breed) => [breed.slug, breed]));
      } catch (error) { }
      const transformedPrediction = transformMediaURLs(req, historyItem);

      // --- FALLBACK LOGIC: Nếu đang xử lý (processing), đọc ảnh tạm từ disk ---
      if (
        transformedPrediction.processedMediaUrl === "processing" ||
        (transformedPrediction.processedMediaUrl &&
          transformedPrediction.processedMediaUrl.includes("processing"))
      ) {
        const os = require('os');
        const TEMP_UPLOAD_DIR = os.tmpdir();
        const processedMediaPathTemp = path.join(
          TEMP_UPLOAD_DIR,
          `processed_${historyId}.txt`
        );
        try {
          if (fs.existsSync(processedMediaPathTemp)) {
            const base64Data = await fs.promises.readFile(
              processedMediaPathTemp,
              "utf-8"
            );
            // Giả sử là ảnh JPEG, nếu video thì cần logic phức tạp hơn chút hoặc chấp nhận ảnh thumbnail
            // Tuy nhiên, prediction.service lưu base64 của ảnh/video đã vẽ bounding box.
            // Với video, AI service trả về base64 của video (mp4) hoặc ảnh (jpg) tùy logic.
            // Ở đây ta cứ gán vào, frontend sẽ hiển thị.
            // Lưu ý: AI service trả về "processed_media_base64" là chuỗi raw base64.
            // Cần xác định mime type.
            // Trong prediction.service, ta thấy:
            // const dataUri = `data:${resource_type === 'video' ? 'video/mp4' : 'image/jpeg'};base64,${base64Data}`;
            // Ta cần check source để biết là video hay ảnh.
            const isVideo = historyItem.source.includes("video");
            const mimeType = isVideo ? "video/mp4" : "image/jpeg";
            transformedPrediction.processedMediaUrl = `data:${mimeType};base64,${base64Data}`;

            // [FIX] RE-FETCH DATA FROM DB
            // Nếu tìm thấy file tạm, nghĩa là Worker đã xong việc.
            // Nhưng 'historyItem' hiện tại có thể là dữ liệu cũ (lấy trước khi Worker update DB).
            // Cần lấy lại dữ liệu mới nhất để đảm bảo có 'predictions'.
            try {
              const freshHistoryItem = await predictionHistoryService.getHistoryById(historyId);
              if (freshHistoryItem && freshHistoryItem.predictions && freshHistoryItem.predictions.length > 0) {
                logger.info(`[BFF] Re-fetched fresh history for ${historyId}. Predictions count: ${freshHistoryItem.predictions.length}`);
                // Cập nhật lại historyItem và transformedPrediction
                historyItem = freshHistoryItem;
                // Merge lại URL ảnh tạm vào item mới (vì item mới trong DB vẫn đang là "processing")
                const freshTransformed = transformMediaURLs(req, freshHistoryItem);
                freshTransformed.processedMediaUrl = `data:${mimeType};base64,${base64Data}`;

                // Gán lại để logic phía dưới dùng dữ liệu mới
                Object.assign(transformedPrediction, freshTransformed);
              }
            } catch (refetchError) {
              logger.warn(`[BFF] Failed to re-fetch fresh history for ${historyId}`, refetchError);
            }

          } else {
            // [FIX] Nếu DB bảo đang processing mà không thấy file tạm
            // Chỉ báo failed nếu job đã tạo quá lâu (ví dụ: > 2 phút)
            // Để tránh trường hợp vừa tạo xong chưa kịp ghi file đã bị báo lỗi
            const jobAge = Date.now() - new Date(historyItem.createdAt).getTime();
            if (jobAge > 5 * 60 * 1000) { // 5 phút
              logger.warn(`[BFF] Temp file missing for STALE processing job ${historyId} (${jobAge}ms). Marking as failed.`);
              transformedPrediction.processedMediaUrl = "failed";
            } else {
              // Nếu mới tạo thì cứ để processing, chờ worker ghi file
              // Frontend sẽ tiếp tục polling
            }
          }
        } catch (e) {
          logger.warn(
            `[BFF] Could not read temp file for history ${historyId}:`,
            e
          );
          // Không set failed ở đây để tránh lỗi đọc file tạm thời
        }
      }
      // -----------------------------------------------------------------------

      const detections = transformedPrediction.predictions.map((p: any) => {
        const slug = p.class.toLowerCase().replace(/\s+/g, "-");
        const breedInfoDoc = wikiInfoMap.get(slug);
        let finalBreedInfo;
        if (breedInfoDoc) {
          finalBreedInfo = createEnrichedBreedInfo(breedInfoDoc);
        } else {
          finalBreedInfo = {
            breed: p.class.toUpperCase(),
            slug: slug,
            group: "Object / Other",
            description:
              lang === "vi"
                ? `Hệ thống nhận diện đây là "${p.class}". Đây không phải là một giống chó trong cơ sở dữ liệu.`
                : `System identified this as "${p.class}". This is not a dog breed in our database.`,
            life_expectancy: "N/A",
            temperament: ["Non-Dog"],
            energy_level: null,
            trainability: null,
            shedding_level: null,
            maintenance_difficulty: null,
            height: "N/A",
            weight: "N/A",
            good_with_children: null,
            suitable_for: [],
          };
        }
        return {
          detectedBreed: slug,
          confidence: p.confidence,
          boundingBox: {
            x: p.box[0],
            y: p.box[1],
            width: p.box[2] - p.box[0],
            height: p.box[3] - p.box[1],
          },
          breedInfo: finalBreedInfo,
        };
      });
      const finalResponse = {
        predictionId: transformedPrediction.id,
        processedMediaUrl: transformedPrediction.processedMediaUrl,
        detections,
        collectionStatus: null,
        hasFeedback: (historyItem as any).hasFeedback,
      };
      res.status(200).json(finalResponse);
    } catch (error) {
      next(error);
    }
  },
  getPredictionStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const status = await predictionService.getPredictionStatus(id);
      res.status(200).json(status);
    } catch (error) {
      next(error);
    }
  },
  handleStreamPrediction: async (ws: WebSocket, req: Request) => {
    const user = (req as any).user as UserDoc | undefined;
    const userId = user?._id?.toString();
    const guestIdentifier = !user
      ? (req as any).fingerprint?.hash || req.ip
      : undefined;
    if (!userId && !guestIdentifier) {
      ws.close(1011, "Could not determine identity.");
      return;
    }
    if (!user && redisClient) {
      const key = `${REDIS_KEYS.GUEST_TOKEN_PREFIX}${guestIdentifier}`;
      const streamCost = tokenConfig.costs.streamSession;
      try {
        let currentTokensStr = await redisClient.get(key);
        let remainingTokens =
          currentTokensStr === null
            ? tokenConfig.guest.initialTokens
            : parseInt(currentTokensStr, 10);
        if (currentTokensStr === null)
          await redisClient.set(key, remainingTokens, {
            EX: tokenConfig.guest.expirationSeconds,
          });
        if (remainingTokens < streamCost) {
          ws.send(
            JSON.stringify({
              type: "error",
              code: "INSUFFICIENT_TOKENS",
              message: "Not enough tokens.",
            })
          );
          ws.close(1008);
          return;
        }
      } catch (e) {
        ws.close(1011);
        return;
      }
    }
    logger.info(`[BFF-WS] ✅ Session start for: ${userId || guestIdentifier}`);
    const aiServiceUrl = (
      process.env.AI_SERVICE_URL || "http://localhost:8000"
    ).replace(/^http/, "ws");
    const aiWs = new WebSocket(`${aiServiceUrl}/predict-stream`);
    aiWs.on("open", () => { });
    aiWs.on("message", (data) => {
      logger.info(`[BFF-WS] AI -> BFF: Nhận kết quả từ AI Service.`);
      if (ws.readyState === WebSocket.OPEN) ws.send(data.toString());
    });
    ws.on("message", (data) => {
      if (aiWs.readyState === WebSocket.OPEN) {
        logger.info(
          `[BFF-WS] Client -> BFF -> AI: Nhận frame từ client và chuyển tiếp đến AI Service.`
        );
        aiWs.send(data, { binary: Buffer.isBuffer(data) });
      }
    });
    const cleanup = () => {
      if (aiWs.readyState === WebSocket.OPEN) aiWs.close();
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
    ws.on("close", cleanup);
    aiWs.on("close", cleanup);
    ws.on("error", cleanup);
    aiWs.on("error", cleanup);
  },
  saveStreamResult: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user?._id?.toString();
      const { processed_media_base64, detections, media_type } = req.body;
      if (!processed_media_base64) throw new BadRequestError("No image data");
      const predictionPromise = predictionService.saveStreamPrediction(
        user?._id,
        {
          processed_media_base64,
          detections: detections || [],
          media_type: media_type || "image/jpeg",
        },
        req
      );
      const data = await handlePredictionAndEnrichment(
        req,
        predictionPromise,
        PREDICTION_SOURCES.STREAM_CAPTURE,
        userId
      );
      await deductTokensForRequest(req, res, tokenConfig.costs.streamSession);
      res.json({
        id: data.predictionId,
        collectionStatus: data.collectionStatus,
      });
    } catch (e) {
      next(e);
    }
  },
  chatWithGemini: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as UserDoc | undefined;
      const { breedSlug } = req.params;
      const { message } = req.body;
      if (!message) throw new BadRequestError("Message is required.");
      const lang =
        req.headers["accept-language"]?.split(",")[0].toLowerCase() === "vi"
          ? "vi"
          : "en";
      const userId = user?._id?.toString();
      const guestIdentifier = user
        ? undefined
        : (req as any).fingerprint?.hash || req.ip;
      if (!userId && !guestIdentifier) {
        throw new Error(
          "Không thể xác định danh tính người dùng hoặc khách cho phiên trò chuyện."
        );
      }
      const result = await askGemini(
        breedSlug,
        message,
        lang,
        userId,
        guestIdentifier
      );
      await deductTokensForRequest(req, res, tokenConfig.costs.chatMessage);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
  getHealthRecommendations: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { breedSlug } = req.params;
      const lang = (
        req.headers["accept-language"]?.split(",")[0].toLowerCase() === "vi"
          ? "vi"
          : "en"
      ) as "vi" | "en";
      const cacheKey = `${REDIS_KEYS.HEALTH_RECOMMENDATIONS_PREFIX}${breedSlug}:${lang}`;
      if (redisClient) {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          return res.status(200).json({ recommendations: cachedData });
        }
      }
      const breedInfo = await wikiService.getBreedBySlug(breedSlug, lang);
      if (
        !breedInfo ||
        !breedInfo.common_health_issues ||
        breedInfo.common_health_issues.length === 0
      ) {
        return res.status(200).json({ recommendations: "" });
      }
      const recommendations = await getHealthRecommendations(
        breedInfo.breed,
        breedInfo.common_health_issues,
        lang
      );
      if (redisClient && recommendations) {
        await redisClient.set(cacheKey, recommendations, {
          EX: REDIS_KEYS.CACHE_24H_SECONDS,
        });
      }
      res.status(200).json({ recommendations });
    } catch (error) {
      next(error);
    }
  },
  getRecommendedProducts: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { breedSlug } = req.params;
      const lang = (
        req.headers["accept-language"]?.split(",")[0].toLowerCase() === "vi"
          ? "vi"
          : "en"
      ) as "vi" | "en";
      const cacheKey = `${REDIS_KEYS.RECOMMENDED_PRODUCTS_PREFIX}${breedSlug}:${lang}`;
      if (redisClient) {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          return res.status(200).json({ products: JSON.parse(cachedData) });
        }
      }
      const breedInfo = await wikiService.getBreedBySlug(breedSlug, lang);
      if (!breedInfo) {
        throw new NotFoundError("Breed not found");
      }
      const productsJsonString = await getRecommendedProducts(
        breedInfo.breed,
        lang
      );
      if (redisClient && productsJsonString && productsJsonString.length > 2) {
        await redisClient.set(cacheKey, productsJsonString, {
          EX: REDIS_KEYS.CACHE_24H_SECONDS,
        });
      }
      try {
        const products = JSON.parse(productsJsonString);
        res.status(200).json({ products });
      } catch (e) {
        logger.error(
          `[BFF Controller] Failed to parse recommended products JSON for breed ${breedSlug}:`,
          e
        );
        logger.error(
          `[BFF Controller] Invalid JSON string was: ${productsJsonString}`
        );
        res.status(200).json({ products: [] });
      }
    } catch (error) {
      next(error);
    }
  },
  getConfig: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
      const response = await fetch(`${aiServiceUrl}/config`);
      if (!response.ok) {
        throw new Error(`AI Service returned ${response.status}`);
      }
      const data = await response.json();
      res.status(200).json(data);
    } catch (error) {
      logger.error("[BFF Controller] Failed to fetch config from AI Service:", error);
      next(error);
    }
  },
  getChatHistory: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { breedSlug } = req.params;
      const user = (req as any).user as UserDoc | undefined;
      const userId = user?._id?.toString();
      const guestIdentifier = user
        ? undefined
        : (req as any).fingerprint?.hash || req.ip;
      const history = await getGeminiChatHistory(
        userId,
        guestIdentifier,
        breedSlug
      );
      res.status(200).json({ history });
    } catch (error) {
      next(error);
    }
  },
};
