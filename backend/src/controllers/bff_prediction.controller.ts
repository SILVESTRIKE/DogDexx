import { Request, Response, NextFunction } from "express";
import WebSocket from "ws";
import crypto from 'crypto';
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
import { askGemini } from "../services/geminiAI.service";
import { redisClient } from "../utils/redis.util";
import { tokenConfig } from "../config/token.config";
import { batchProcessor } from '../utils/BatchProcessor.util';
import { deductTokensForRequest } from "../middlewares/deductTokens.middleware";
import { DogBreedWikiDoc } from "../models/dogs_wiki.model";
import { UserDoc, UnlockedAchievement } from "../models/user.model";

// THÊM: Định nghĩa một kiểu dữ liệu rõ ràng cho một item trong mảng predictions
interface PredictionItem {
  class: string;
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

  // SỬA LỖI: Ép kiểu userAfterUpdate thành UserDoc để TypeScript hiểu
  const achievementsResult = await achievementService.processUserAchievements(
    userAfterUpdate as UserDoc,
    newCollections,
    lang
  );
  // Đổi cách tiếp cận: Khai báo kiểu rõ ràng cho biến thay vì ép kiểu ở cuối.
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
    // Ép kiểu trực tiếp kết quả cuối cùng để đảm bảo type-safety
    achievementsUnlocked: unlockedAchievements.map(
      (ach) => ach.key
    ) as string[],
  };
}

async function handlePredictionAndEnrichment(
  req: Request,
  predictionPromise: Promise<any>,
  source: "image_upload" | "video_upload" | "stream_capture",
  userId?: string
) {
  const lang =
    req.headers["accept-language"]?.split(",")[0].toLowerCase() === "vi"
      ? "vi"
      : "en";

  const predictionResult = await predictionPromise;
  if (!predictionResult)
    throw new NotFoundError("Prediction result could not be created or found.");

  // SỬA LỖI & TỐI ƯU: Sử dụng kiểu đã định nghĩa và đảm bảo predictions là một mảng.
  // Điều này giúp TypeScript hiểu rõ cấu trúc và loại bỏ lỗi.
  const predictionsArray: PredictionItem[] = Array.isArray(
    predictionResult.predictions
  )
    ? predictionResult.predictions
    : [];
  const breedSlugs: string[] = [
    ...new Set(
      predictionsArray.map((p: PredictionItem) =>
        p.class.toLowerCase().replace(/\s+/g, "-")
      )
    ),
  ];

  let wikiInfoMap = new Map<string, DogBreedWikiDoc>();
  if (breedSlugs.length > 0) {
    const breeds = await wikiService.getBreedsBySlugs(breedSlugs, lang);
    breeds.forEach((breed) => wikiInfoMap.set(breed.slug, breed));
  }

  const collectionStatus = userId
    ? await updateUserCollectionAndAchievements(
        userId,
        breedSlugs,
        predictionResult._id,
        req
      )
    : null;

  const predictionObject = predictionResult.toObject
    ? predictionResult.toObject()
    : predictionResult;
  const transformedPrediction = transformMediaURLs(req, predictionObject);

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
    processedMediaUrl: transformedPrediction.processedMediaUrl,
    detections: detections,
    collectionStatus: collectionStatus,
  };
}

export const bffPredictionController = {
  predictImage: async (req: Request, res: Response) => {
    const user = (req as any).user as UserDoc | undefined;
    const userId = user?._id as Types.ObjectId | undefined;
    const file = req.file;
    if (!file) throw new BadRequestError("Không có file nào được cung cấp.");

    const predictionPromise = predictionService.makePrediction(
      userId,
      file,
      "image",
      req
    );
    const data = await handlePredictionAndEnrichment(
      req,
      predictionPromise,
      "image_upload",
      userId?.toString()
    );

    await deductTokensForRequest(
      req,
      res,
      tokenConfig.costs.imagePrediction,
      "single"
    );

    res.status(200).json(data);
  },

  predictVideo: async (req: Request, res: Response) => {
    const user = (req as any).user as UserDoc | undefined;
    // SỬA ĐỔI: Truyền `res` vào hàm trừ token
    const userId = user?._id as Types.ObjectId | undefined;
    const file = req.file;
    if (!file) throw new BadRequestError("Không có file nào được cung cấp.");

    const predictionPromise = predictionService.makePrediction(
      userId,
      file,
      "video",
      req
    );
    const data = await handlePredictionAndEnrichment(
      req,
      predictionPromise,
      "video_upload",
      userId?.toString()
    );

    await deductTokensForRequest(
      req,
      res,
      tokenConfig.costs.videoPrediction,
      "single"
    );

    res.status(200).json(data);
  },

  predictBatch: async (req: Request, res: Response) => {
    const user = (req as any).user as UserDoc | undefined;
    // SỬA ĐỔI: Truyền `res` vào hàm trừ token
    const userId = user?._id as Types.ObjectId | undefined;
    const lang =
      req.headers["accept-language"]?.split(",")[0].toLowerCase() === "vi"
        ? "vi"
        : "en";
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new BadRequestError("Không có file nào được cung cấp.");
    }

    const batchPredictionResults = await predictionService.makeBatchPredictions(
      userId,
      files,
      req
    );
    const allSlugs: string[] = batchPredictionResults.flatMap((result) =>
      result.predictions.map((p) => p.class.toLowerCase().replace(/\s+/g, "-"))
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

    await deductTokensForRequest(
      req,
      res,
      tokenConfig.costs.imagePrediction,
      "batch"
    );

    res.status(200).json(results);
  },

  submitFeedback: async (req: Request, res: Response) => {
    const userId = (req as any).user?._id;
    const { id: predictionId } = req.params;
    const { isCorrect, submittedLabel, notes } = req.body;
    const result = await feedbackService.submitFeedback(userId, {
      predictionId,
      isCorrect,
      submittedLabel,
      notes,
    });
    const newBreedAlert = !isCorrect && submittedLabel;
    res.status(201).json({
      feedbackId: (result as any)._id,
      message: "Feedback submitted successfully",
      newBreedAlert,
    });
  },

  deletePredictionHistory: async (req: Request, res: Response) => {
    const userId = (req as any).user!._id;
    const { id: historyId } = req.params;
    const result = await predictionHistoryService.deleteHistoryForUser(
      userId,
      historyId
    );
    res.status(200).json(result);
  },

  getPredictionHistory: async (req: Request, res: Response) => {
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
          name: item.media.name,
          mediaUrl: item.media.mediaUrl,
          type: item.media.type,
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
  },

  getPredictionHistoryById: async (req: Request, res: Response) => {
    const { id: historyId } = req.params;
    const lang =
      req.query.lang === "vi" || req.query.lang === "en"
        ? (req.query.lang as "vi" | "en")
        : "en";
    const historyItem = await predictionHistoryService.getHistoryById(
      historyId
    );
    if (!historyItem) throw new NotFoundError("Prediction history not found.");
    const breedSlugs: string[] = [
      ...new Set(
        historyItem.predictions.map((p: any) =>
          p.class.toLowerCase().replace(/\s+/g, "-")
        )
      ),
    ];
    const breeds = await wikiService.getBreedsBySlugs(breedSlugs, lang);
    const wikiInfoMap = new Map(breeds.map((breed) => [breed.slug, breed]));
    const transformedPrediction = transformMediaURLs(
      req,
      historyItem.toObject()
    );
    const detections = transformedPrediction.predictions.map((p: any) => {
      const slug = p.class.toLowerCase().replace(/\s+/g, "-");
      return {
        detectedBreed: slug,
        confidence: p.confidence,
        boundingBox: {
          x: p.box[0],
          y: p.box[1],
          width: p.box[2] - p.box[0],
          height: p.box[3] - p.box[1],
        },
        breedInfo: createEnrichedBreedInfo(wikiInfoMap.get(slug)),
      };
    });
    const finalResponse = {
      predictionId: transformedPrediction.id,
      processedMediaUrl: transformedPrediction.processedMediaUrl,
      detections,
      collectionStatus: null,
    };
    res.status(200).json(finalResponse);
  },

  handleStreamPrediction: async (ws: WebSocket, req: Request) => {
    // BƯỚC 1: LẤY ĐỊNH DANH (giữ nguyên)
    const user = (req as any).user as UserDoc | undefined;
    const userId = user?._id?.toString(); // Lấy userId nếu đã đăng nhập

    // SỬA LỖI: Ưu tiên định danh do client cung cấp (đã được gán trong wsOptionalAuthMiddleware)
    // Điều này đảm bảo tính nhất quán với các request HTTP khác.
    const guestIdentifier = !user ? ((req as any).fingerprint?.hash || req.ip) : undefined;


    // BƯỚC 2: KIỂM TRA TÍNH TOÀN VẸN SESSION (giữ nguyên)
    if (!userId && !guestIdentifier) {
      logger.error("[BFF-WS] Critical: Could not determine identifier for WebSocket session. Closing connection.");
      ws.close(1011, "Could not determine user identity.");
      return;
    }

    // ======================== THÊM MỚI TẠI ĐÂY ========================
    // BƯỚC 2A: KIỂM TRA & KHỞI TẠO TOKEN CHO KHÁCH (NẾU LÀ KHÁCH)
    if (!user && redisClient) {
      const key = `guest:token:${guestIdentifier}`;
      const streamCost = tokenConfig.costs.streamSession;

      try {
        let currentTokensStr = await redisClient.get(key);
        let remainingTokens: number;

        // Nếu là khách mới, khởi tạo token cho họ
        if (currentTokensStr === null) {
          remainingTokens = tokenConfig.guest.initialTokens;
          await redisClient.set(key, remainingTokens, {
            EX: tokenConfig.guest.expirationSeconds,
          });
          logger.info(`[BFF-WS] Initialized ${remainingTokens} tokens for new guest ${guestIdentifier}.`);
        } else {
          remainingTokens = parseInt(currentTokensStr, 10);
        }

        // Kiểm tra xem họ có đủ token để bắt đầu stream không
        if (remainingTokens < streamCost) {
          logger.warn(`[BFF-WS] Guest ${guestIdentifier} has insufficient tokens for stream. Required: ${streamCost}, Remaining: ${remainingTokens}. Closing connection.`);
          ws.send(JSON.stringify({ type: 'error', message: 'Not enough tokens for streaming session.' }));
          ws.close(1008, "Insufficient tokens");
          return; // Dừng thực thi
        }
      } catch (error) {
        logger.error(`[BFF-WS] Redis error during token check for guest ${guestIdentifier}:`, error);
        ws.close(1011, "Server error during token check.");
        return;
      }
    }

    logger.info(
      `[BFF-WS] Session started. User: ${userId || "Guest"}, Identifier: ${
        guestIdentifier || "N/A"
      }`
    );

    // Khởi tạo các biến và kết nối cần thiết cho phiên làm việc
    const lang =
      req.headers["accept-language"]?.split(",")[0].toLowerCase() === "vi"
        ? "vi"
        : "en"; 
    const aiServiceUrl = (
      process.env.AI_SERVICE_URL || "http://localhost:8000"
    ).replace(/^http/, "ws");
    const aiServiceWs = new WebSocket(`${aiServiceUrl}/predict-stream`);
    const wikiCache = new Map<string, any>();
    let finalResultSent = false;
    let tokensDeducted = false;

    // BƯỚC 3: TẠO MỘT HÀM HELPER ĐỂ TÁI TẠO CONTEXT CỦA REQUEST
    // Hàm này sẽ tạo một đối tượng `req` giả mạo nhưng chứa đầy đủ thông tin định danh
    // đã được lưu trữ, đảm bảo các service khác có thể sử dụng.
    const createMockRequest = (): Request => {
      const protocol =
        (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
      const host =
        (req.headers["x-forwarded-host"] as string) ||
        (req.headers.host as string);

      return {
        user: user,
        ip: req.ip, // Giữ lại IP gốc từ request ban đầu
        // Tái tạo lại đối tượng fingerprint với hash đã lưu
        fingerprint: { hash: guestIdentifier },
        headers: req.headers,
        protocol: protocol,
        get: (header: string) =>
          header.toLowerCase() === "host"
            ? host
            : req.headers[header.toLowerCase()],
      } as unknown as Request; 
    };

    // --- XỬ LÝ KẾT NỐI ĐẾN AI SERVICE (BFF <-> AI Service) ---

    aiServiceWs.on("open", () => {
      logger.info(
        `[BFF-WS] Connection to AI Service established for user: ${
          userId || guestIdentifier
        }.`
      );
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({ type: "status", message: "Connected to AI Service" })
        );
      }
    });

    aiServiceWs.on("message", async (data) => {
      const message = JSON.parse(data.toString());
      if (ws.readyState !== WebSocket.OPEN) return;

      // Xử lý các frame dự đoán trung gian
      if (message.detections && !message.status) {
        const breedSlugs = [
          ...new Set(
            message.detections.map((p: any) =>
              p.class.toLowerCase().replace(/\s+/g, "-")
            )
          ),
        ];
        const slugsToFetch = (breedSlugs as string[]).filter(
          (slug: string) => !wikiCache.has(slug)
        );

        if (slugsToFetch.length > 0) {
          const breeds = await wikiService.getBreedsBySlugs(
            slugsToFetch as string[],
            lang
          );
          breeds.forEach((breed) => wikiCache.set(breed.slug, breed));
        }

        const detections = message.detections.map((p: any) => ({
          detectedBreed: p.class.toLowerCase().replace(/\s+/g, "-"),
          confidence: p.confidence,
          boundingBox: {
            x: p.box[0],
            y: p.box[1],
            width: p.box[2] - p.box[0],
            height: p.box[3] - p.box[1],
          },
          breedInfo: createEnrichedBreedInfo(
            wikiCache.get(p.class.toLowerCase().replace(/\s+/g, "-"))
          ),
        }));
        ws.send(JSON.stringify({ type: "detections", detections }));
      }

      // Xử lý khi có kết quả cuối cùng từ AI Service
      if (message.status === "captured" && !finalResultSent) {
        finalResultSent = true;
        try {
          const mockReq = createMockRequest();
          const payloadForSaving = {
            processed_media_base64: message.processed_media_base64,
            detections: message.detections,
            media_type: message.media_type,
          };
          const savedPrediction = await predictionService.saveStreamPrediction(
            user?._id as Types.ObjectId | undefined,
            payloadForSaving,
            mockReq
          );
          const enrichedResult = await handlePredictionAndEnrichment(
            mockReq,
            Promise.resolve(savedPrediction),
            "stream_capture",
            userId
          );

          // ======================== THAY ĐỔI LOGIC TRỪ TOKEN ========================
          // Chỉ trừ token KHI có kết quả cuối cùng và chỉ trừ MỘT LẦN.
          if (!tokensDeducted) {
            tokensDeducted = true;
            deductTokensForRequest(mockReq, {} as Response, tokenConfig.costs.streamSession, 'stream')
              .then(() => logger.info(
                `[BFF-WS] Token deduction processed for session of ${userId || guestIdentifier} after final result.`
              ))
              .catch((err) => logger.error(
                `[BFF-WS] Failed to process token deduction after stream final result:`, err
              ));
          }
          // ==========================================================================


          ws.send(JSON.stringify({ type: "final_result", ...enrichedResult }));
          ws.send(
            JSON.stringify({
              type: "endOfStream",
              message: "Stream completed successfully",
            })
          );
          if (ws.readyState === WebSocket.OPEN)
            ws.close(1000, "Stream completed successfully");
          if (aiServiceWs.readyState === WebSocket.OPEN)
            aiServiceWs.close(1000, "Stream completed successfully");
        } catch (error) {
          logger.error(
            "[BFF-WS] Error saving or enriching stream result:",
            error
          );
        }
      }
    });

    aiServiceWs.on("error", (error) => {
      logger.error("[BFF-WS] AI Service WebSocket error:", error);
      if (ws.readyState === WebSocket.OPEN) ws.close(1011, "AI service error");
    });

    aiServiceWs.on("close", (code, reason) => {
      logger.info(
        `[BFF-WS] AI Service connection closed. Code: ${code}, Reason: ${reason.toString()}`
      );
      if (!finalResultSent && ws.readyState === WebSocket.OPEN) {
        ws.close(code, reason.toString());
      }
    });

    // --- XỬ LÝ KẾT NỐI TỪ CLIENT (Client <-> BFF) ---

    ws.on("message", (message) => {
      if (aiServiceWs.readyState === WebSocket.OPEN) {

        aiServiceWs.send(message.toString());
      } else {
        logger.warn(
          "[BFF-WS] Client sent a message, but AI service is not connected. Dropping frame."
        );
      }
    });

    ws.on("close", () => {
      logger.info(
        `[BFF-WS] Client connection closed for user: ${
          userId || guestIdentifier
        }.`
      );
      if (aiServiceWs.readyState === WebSocket.OPEN) {
        aiServiceWs.close(1000, "Client closed BFF connection");
      }
    });

    ws.on("error", (error) => {
      logger.error("[BFF-WS] Client WebSocket error:", error);
      if (aiServiceWs.readyState === WebSocket.OPEN) {
        aiServiceWs.close(1011, "Client connection error");
      }
    });
  },
  

  chatWithGemini: async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as UserDoc | undefined;
    const { breedSlug } = req.params;
    const { message } = req.body;
    if (!message) throw new BadRequestError("Message is required.");
    const lang =
      req.headers["accept-language"]?.split(",")[0].toLowerCase() === "vi"
        ? "vi"
        : "en";

    // CẢI TIẾN: Xác định định danh người dùng hoặc khách để có lịch sử chat riêng
    const userId = user?._id?.toString();
    const guestIdentifier = user
      ? undefined
      : (req as any).fingerprint?.hash || req.ip;

    if (!userId && !guestIdentifier) {
      throw new Error("Không thể xác định danh tính người dùng hoặc khách cho phiên trò chuyện.");
    }

    const result = await askGemini(
      breedSlug,
      message,
      lang,
      userId,
      guestIdentifier
    ); // Truyền định danh vào service

    await deductTokensForRequest(req, res, tokenConfig.costs.chatMessage);

    res.status(200).json(result);
  },
};
