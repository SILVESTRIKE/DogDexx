import { Request, Response, NextFunction } from "express";
import WebSocket from "ws";
import { Types } from "mongoose";
import { predictionService } from "../services/prediction.service";
import { wikiService } from "../services/dogs_wiki.service";
import { BadRequestError, NotFoundError } from "../errors";
import { transformMediaURLs } from "../utils/media.util";
import { feedbackService } from "../services/feedback.service";
import { DogBreedWikiDoc } from "../models/dogs_wiki.model";
import { PredictionHistoryDoc, IYoloPrediction } from "../models/prediction_history.model";
import { UserModel, UnlockedAchievement } from "../models/user.model";
import { collectionService } from "../services/user_collections.service";
import { achievementService } from "../services/achievement.service";
import { userService } from "../services/user.service";
import { logger } from "../utils/logger.util";
import { predictionHistoryService } from "../services/prediction_history.service";
import { incrementUsage } from "../middlewares/usageLimiter.middleware";

/**
 * Hàm phụ trợ để tạo đối tượng breedInfo được làm giàu và chọn lọc.
 * @param breedInfoDoc Document từ Mongoose của DogBreedWiki.
 * @returns Một object chỉ chứa các trường cần thiết cho frontend.
 */
function createEnrichedBreedInfo(breedInfoDoc: DogBreedWikiDoc | null | undefined) {
  if (!breedInfoDoc) return null;
  return {
    // Core Info
    breed: breedInfoDoc.breed,
    slug: breedInfoDoc.slug,
    group: breedInfoDoc.group,
    description: breedInfoDoc.description,
    life_expectancy: breedInfoDoc.life_expectancy,
    temperament: breedInfoDoc.temperament,
    // Ratings
    energy_level: breedInfoDoc.energy_level,
    trainability: breedInfoDoc.trainability,
    shedding_level: breedInfoDoc.shedding_level,
    maintenance_difficulty: breedInfoDoc.maintenance_difficulty,
    // Lifestyle Context
    height: breedInfoDoc.height,
    weight: breedInfoDoc.weight,
    good_with_children: breedInfoDoc.good_with_children,
    suitable_for: breedInfoDoc.suitable_for,
  };
}

/**
 * [HELPER] Cập nhật bộ sưu tập và thành tích của người dùng sau một dự đoán.
 * @param userId ID của người dùng
 * @param breedSlugs Các slug giống chó được phát hiện
 * @param predictionId ID của bản ghi lịch sử dự đoán
 * @param req Request object để lấy ngôn ngữ
 * @returns Trạng thái collection hoặc null
 */
async function updateUserCollectionAndAchievements(userId: string, breedSlugs: string[], predictionId: Types.ObjectId, req: Request) {
  if (!userId || breedSlugs.length === 0) {
    return null;
  }

  const userObjectId = new Types.ObjectId(userId);
  const [userBeforeUpdate, oldCollections] = await Promise.all([
    userService.getById(userId),
    collectionService.getUserCollection(userObjectId)
  ]);

  if (!userBeforeUpdate) throw new BadRequestError("User not found before update.");

  await collectionService.addOrUpdateManyCollections(userObjectId, breedSlugs, predictionId);

  const [userAfterUpdate, newCollections] = await Promise.all([
    userService.getById(userId),
    collectionService.getUserCollection(userObjectId)
  ]);

  if (!userAfterUpdate) throw new BadRequestError("User not found after update.");

  const lang = (req.headers['accept-language']?.split(',')[0].toLowerCase() === 'vi') ? 'vi' : 'en';
  const achievementsResult = await achievementService.processUserAchievements(userAfterUpdate, newCollections, lang);
  
  // *** SỬA LỖI TẠI ĐÂY ***
  // Thêm `|| []` để phòng trường hợp userBeforeUpdate.achievements là undefined
  const unlockedAchievements = achievementsResult.filter(ach => ach.unlocked && !(userBeforeUpdate.achievements || []).some((oldAch: UnlockedAchievement) => oldAch.key === ach.key));

  return {
    isNewBreed: newCollections.length > oldCollections.length,
    totalCollected: newCollections.length,
    achievementsUnlocked: unlockedAchievements.map(ach => ach.key)
  };
}
/**
 * Hàm phụ trợ để xử lý logic chung cho việc dự đoán và làm giàu dữ liệu.
 * PHIÊN BẢN NÂNG CẤP: Xử lý TẤT CẢ các dự đoán, không chỉ cái chính.
 */
async function handlePredictionAndEnrichment(req: Request, predictionPromise: Promise<PredictionHistoryDoc>, source: 'image_upload' | 'video_upload' | 'stream_capture', userId?: string) {
  // 1. Await the raw prediction result from the core service
  const predictionResult = await predictionPromise;

  // 2. Trích xuất các slug giống chó duy nhất từ TẤT CẢ các kết quả để chuẩn bị làm giàu
  const breedSlugs: string[] = [...new Set(predictionResult.predictions.map((p) => p.class.toLowerCase().replace(/\s+/g, '-')))];

  // Tạo một map để tra cứu thông tin wiki một cách hiệu quả
  let wikiInfoMap = new Map<string, DogBreedWikiDoc>();
  if (breedSlugs.length > 0) {
    const breeds = await wikiService.getBreedsBySlugs(breedSlugs);
    breeds.forEach(breed => wikiInfoMap.set(breed.slug, breed));
  }

  // 3. If user is logged in, update collection and check for achievements
  const collectionStatus = await updateUserCollectionAndAchievements(userId!, breedSlugs, predictionResult._id as Types.ObjectId, req);

  // 4. Chuyển đổi URL media trong kết quả
  const predictionObject = predictionResult.toObject();
  const transformedPrediction = transformMediaURLs(req, predictionObject);

  const detections = transformedPrediction.predictions.map((p: any) => {
    const slug = p.class.toLowerCase().replace(/\s+/g, '-');
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

  // 6. Xây dựng response cuối cùng theo cấu trúc mới
  const finalResponse = {
    predictionId: transformedPrediction.id,
    processedMediaUrl: transformedPrediction.processedMediaUrl,
    detections: detections,
    collectionStatus: collectionStatus,
  };

  return finalResponse;
}

export const bffPredictionController = {
  predictImage: async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const file = req.file;
    if (!file) throw new BadRequestError("Không có file nào được cung cấp.");

    const predictionPromise = predictionService.makePrediction(userId, file, "image", req);
    const data = await handlePredictionAndEnrichment(req, predictionPromise, 'image_upload', userId?.toString());
    await incrementUsage(req);
    res.status(200).json(data);
  },

  predictVideo: async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const file = req.file;
    if (!file) throw new BadRequestError("Không có file nào được cung cấp.");

    const predictionPromise = predictionService.makePrediction(userId, file, "video", req);
    const data = await handlePredictionAndEnrichment(req, predictionPromise, 'video_upload', userId?.toString());
    await incrementUsage(req);
    res.status(200).json(data);
  },

  predictBatch: async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new BadRequestError("Không có file nào được cung cấp.");
    }

    const batchPredictionResults = await predictionService.makeBatchPredictions(userId, files, req);
    const allSlugs = batchPredictionResults.flatMap(result => result.predictions.map(p => p.class.toLowerCase().replace(/\s+/g, '-')));
    const uniqueSlugs: string[] = [...new Set(allSlugs)];

    let wikiInfoMap = new Map<string, DogBreedWikiDoc>();
    let collectionStatus: any = null;

    const enrichmentPromises: Promise<any>[] = [
      wikiService.getBreedsBySlugs(uniqueSlugs).then(breeds => {
        breeds.forEach(breed => wikiInfoMap.set(breed.slug, breed));
      })
    ];

    if (userId && uniqueSlugs.length > 0) {
      const userObjectId = new Types.ObjectId(userId);
      enrichmentPromises.push(
        (async () => {
          const [userBeforeUpdate, oldCollections] = await Promise.all([
            userService.getById(userObjectId.toString()),
            collectionService.getUserCollection(userObjectId)
          ]);
          if (!userBeforeUpdate) return;
          await collectionService.addOrUpdateFromPredictionResults(userObjectId, batchPredictionResults);
          const [userAfterUpdate, newCollections] = await Promise.all([
            userService.getById(userObjectId.toString()),
            collectionService.getUserCollection(userObjectId)
          ]);
          if (!userAfterUpdate) return;

          const lang = (req.headers['accept-language']?.split(',')[0].toLowerCase() === 'vi') ? 'vi' : 'en';
          const achievementsResult = await achievementService.processUserAchievements(userAfterUpdate, newCollections, lang);
          const unlockedAchievements = achievementsResult.filter(ach => ach.unlocked && !(userBeforeUpdate.achievements || []).some((oldAch: UnlockedAchievement) => oldAch.key === ach.key));
          collectionStatus = {
            isNewBreed: newCollections.length > oldCollections.length,
            totalCollected: newCollections.length,
            achievementsUnlocked: unlockedAchievements.map(ach => ach.key)
          };
        })()
      );
    }

    await Promise.all(enrichmentPromises);

    const results = batchPredictionResults.map(predictionResult => {
      const transformedPrediction = transformMediaURLs(req, predictionResult.toObject());
      const detections = transformedPrediction.predictions.map((p: any) => {
          const slug = p.class.toLowerCase().replace(/\s+/g, '-');
          const breedInfoDoc = wikiInfoMap.get(slug);
          return {
              detectedBreed: slug,
              confidence: p.confidence,
              boundingBox: { x: p.box[0], y: p.box[1], width: p.box[2] - p.box[0], height: p.box[3] - p.box[1] },
              breedInfo: createEnrichedBreedInfo(breedInfoDoc),
          };
      });

      return {
        predictionId: transformedPrediction.id,
        originalFilename: (transformedPrediction.media as any)?.name || 'unknown',
        processedMediaUrl: transformedPrediction.processedMediaUrl,
        detections: detections,
        collectionStatus: collectionStatus
      };
    });

    await incrementUsage(req);
    res.status(200).json(results);
  },

  submitFeedback: async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { id: predictionId } = req.params;
    const { isCorrect, submittedLabel, notes } = req.body;

    const result = await feedbackService.submitFeedback(userId, { predictionId, isCorrect, submittedLabel, notes });
    const newBreedAlert = !isCorrect && submittedLabel;

    res.status(201).json({ feedbackId: (result as any)._id, message: 'Feedback submitted successfully', newBreedAlert });
  },

  /**
   * @desc [User] Xóa một bản ghi lịch sử dự đoán của chính họ.
   * @route DELETE /bff/predict/history/:id
   * @access Private
   */
  deletePredictionHistory: async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { id: historyId } = req.params;
    const result = await predictionHistoryService.deleteHistoryForUser(userId, historyId);
    res.status(200).json(result);
  },

  getPredictionHistory: async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { page = 1, limit = 10 } = req.query;

    const historyResult = await predictionHistoryService.getHistoryForUser(userId, {
      page: Number(page),
      limit: Number(limit),
    });

    // 1. Thu thập tất cả các slug duy nhất từ toàn bộ lịch sử
    const allSlugs = [...new Set(historyResult.histories.flatMap(h => h.predictions.map(p => p.class.toLowerCase().replace(/\s+/g, '-'))))];

    // 2. Tạo một map để tra cứu thông tin breed hiệu quả
    const wikiInfoMap = new Map<string, { breed: string }>();
    if (allSlugs.length > 0) {
      const breeds = await wikiService.getBreedsBySlugs(allSlugs);
      breeds.forEach(breed => wikiInfoMap.set(breed.slug, { breed: breed.breed }));
    }

    // 3. Làm giàu dữ liệu trả về
    const enrichedData = historyResult.histories.map(historyItem => {
      const item = transformMediaURLs(req, historyItem.toObject());
      const detections = (item.predictions || []).map((p: any) => {
        const slug = p.class.toLowerCase().replace(/\s+/g, '-');
        const breedInfo = wikiInfoMap.get(slug);
        return {
          detectedBreed: slug,
          breedName: breedInfo?.breed || slug, // Thêm breedName
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
          name: item.media.name,
          mediaUrl: item.media.mediaUrl,
          type: item.media.type,
        },
        source: item.source, // Đảm bảo source được trả về
      };
    });

    res.status(200).json({
      histories: enrichedData,
      total: historyResult.total,
      page: historyResult.page,
      limit: historyResult.limit,
      totalPages: historyResult.totalPages,
    });
  },

  /**
   * @desc [User] Lấy một bản ghi lịch sử dự đoán theo ID và làm giàu dữ liệu.
   * @route GET /bff/predict/history/:id
   * @access Private
   */
  getPredictionHistoryById: async (req: Request, res: Response) => {
    const userId = req.user?._id; // Cho phép userId là undefined cho người dùng khách
    const { id: historyId } = req.params;

    const historyItem = await predictionHistoryService.getHistoryById(historyId); // Gọi hàm service mới/cập nhật
    if (!historyItem) {
      throw new NotFoundError("Prediction history not found.");
    }

    const breedSlugs: string[] = [...new Set(historyItem.predictions.map((p: IYoloPrediction) => p.class.toLowerCase().replace(/\s+/g, '-')))];
    const breeds = await wikiService.getBreedsBySlugs(breedSlugs);
    const wikiInfoMap = new Map<string, DogBreedWikiDoc>(breeds.map(breed => [breed.slug, breed]));

    const transformedPrediction = transformMediaURLs(req, historyItem.toObject());

    const detections = (transformedPrediction.predictions as IYoloPrediction[]).map((p: IYoloPrediction) => {
      const slug = p.class.toLowerCase().replace(/\s+/g, '-');
      return { detectedBreed: slug, confidence: p.confidence, boundingBox: { x: p.box[0], y: p.box[1], width: p.box[2] - p.box[0], height: p.box[3] - p.box[1] }, breedInfo: createEnrichedBreedInfo(wikiInfoMap.get(slug)) };
    });

    const finalResponse = { predictionId: transformedPrediction.id, processedMediaUrl: transformedPrediction.processedMediaUrl, detections: detections, collectionStatus: null };
    res.status(200).json(finalResponse);
  },


  handleStreamPrediction: async (ws: WebSocket, req: Request) => {
    const userId = req.user?._id?.toString();
    const aiServiceUrl = (process.env.AI_SERVICE_URL || "http://localhost:8000").replace(/^http/, 'ws');
    const aiServiceWs = new WebSocket(`${aiServiceUrl}/predict-stream`);

    const wikiCache = new Map<string, any>();
    let finalResultSent = false;

    const createMockRequest = () => {
        const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
        const host = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string);
        
        return {
            protocol: protocol,
            get: (header: string) => {
                if (header.toLowerCase() === 'host') return host;
                return req.headers[header.toLowerCase()]; 
            },
            headers: req.headers,
            ip: req.ip,
            fingerprint: (req as any).fingerprint,
        } as unknown as Request;
    }

    aiServiceWs.on('open', () => {
      logger.info(`[BFF-WS] Established WebSocket connection to AI Service for user: ${userId || 'guest'}`);
      if (aiServiceWs.readyState === WebSocket.OPEN) aiServiceWs.send(JSON.stringify({ type: 'ping' }));
    });

    aiServiceWs.on('message', async (message: WebSocket.Data) => {
      const messageString = message.toString();
      let data;

      try {
        data = JSON.parse(messageString);
      } catch (e) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageString);
        }
        return;
      }

      try {
        if (data && Array.isArray(data.detections)) {
          const slugsToFetch = [...new Set(data.detections.map((p: any) => p.class.toLowerCase().replace(/\s+/g, '-')).filter((slug: string) => !wikiCache.has(slug)))] as string[];

          if (slugsToFetch.length > 0) {
            const breeds = await wikiService.getBreedsBySlugs(slugsToFetch);
            breeds.forEach(breed => wikiCache.set(breed.slug, breed.toObject()));
          }
          if (data.status === 'captured') {
            logger.info(`[BFF-WS] Received 'captured' result. Saving to database...`);
            const mockReq = createMockRequest();
            const predictionPromise = predictionService.saveStreamPrediction(userId ? new Types.ObjectId(userId) : undefined, data, mockReq);
            const finalResponse = await handlePredictionAndEnrichment(mockReq, predictionPromise, 'stream_capture', userId);
            
            ws.send(JSON.stringify({ status: 'redirect', payload: finalResponse }));
            finalResultSent = true;

            if (aiServiceWs.readyState === WebSocket.OPEN) {
              aiServiceWs.close(1000, "Final result sent to client");
            }
          } else {
            const enrichedDetections = data.detections.map((p: any) => {
              const slug = p.class.toLowerCase().replace(/\s+/g, '-');
              const breedInfoDoc = wikiCache.get(slug);
              return { 
                detectedBreed: slug, 
                confidence: p.confidence, 
                boundingBox: { x: p.box[0], y: p.box[1], width: p.box[2] - p.box[0], height: p.box[3] - p.box[1] }, 
                breedInfo: createEnrichedBreedInfo(breedInfoDoc) 
              };
            });
            ws.send(JSON.stringify({ detections: enrichedDetections }));
          }
        } else {
          ws.send(messageString);
        }
      } catch (error) {
        logger.error('[BFF-WS] Error processing message from AI service:', error);
        ws.send(JSON.stringify({ error: 'Failed to process prediction data.' }));
        if (aiServiceWs.readyState === WebSocket.OPEN) aiServiceWs.close(1001, "BFF internal error");
      }
    });

    ws.on('message', (message: WebSocket.Data) => {
      if (aiServiceWs.readyState === WebSocket.OPEN) {
        aiServiceWs.send(message.toString());
      }
    });

    ws.on('close', () => {
      logger.info(`[BFF-WS] Client connection closed. Closing connection to AI Service.`);
      if (aiServiceWs.readyState === WebSocket.OPEN && !finalResultSent) {
        aiServiceWs.close(1000, "Client closed BFF connection");
      }

      if (req.user) {
        (req as any).mediaType = 'video'; 
        incrementUsage(req).catch(err => logger.error('[BFF-WS] Failed to increment usage on stream close:', err));
      }
    });
    aiServiceWs.on('close', (code, reason) => {
      if (!finalResultSent) {
        logger.info(`[BFF-WS] AI Service connection closed. Closing connection to client. Reason: ${reason.toString()}`);
        if (ws.readyState === WebSocket.OPEN) {
            if (code !== 1000) { 
                 ws.send(JSON.stringify({ error: `AI service disconnected unexpectedly (Code: ${code}).` }));
            }
            ws.close(code, reason.toString());
        }
      } else {
         logger.info(`[BFF-WS] AI Service closed after final result was sent. Code: ${code}`);
      }
    });
  }
};