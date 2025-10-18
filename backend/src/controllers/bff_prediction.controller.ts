// bff prediction_controller.ts
import { Request, Response, NextFunction } from "express";
import WebSocket from "ws";
import { Types } from "mongoose";
import { predictionService } from "../services/prediction.service";
import { wikiService } from "../services/dogs_wiki.service";
import { BadRequestError } from "../errors";
import { transformMediaURLs } from "../utils/media.util";
import { feedbackService } from "../services/feedback.service";
import { DogBreedWikiDoc } from "../models/dogs_wiki.model";
import { PredictionHistoryDoc } from "../models/prediction_history.model";
import { UserModel, UnlockedAchievement } from "../models/user.model"; // THÊM IMPORT
import { collectionService } from "../services/user_collections.service";
import { achievementService } from "../services/achievement.service";
import { userService } from "../services/user.service"; // THÊM IMPORT
import { predictionHistoryController } from "./prediction_history.controller";
import { logger } from "../utils/logger";

/**
 * Hàm phụ trợ để tạo đối tượng breedInfo được làm giàu và chọn lọc.
 * @param breedInfoDoc Document từ Mongoose của DogBreedWiki.
 * @returns Một object chỉ chứa các trường cần thiết cho frontend.
 */
function createEnrichedBreedInfo(breedInfoDoc: DogBreedWikiDoc | null | undefined) {
  if (!breedInfoDoc) return null;
  return {
    // Core Info
    breed: breedInfoDoc.breed, // Sửa từ display_name
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
 * Hàm phụ trợ để xử lý logic chung cho việc dự đoán và làm giàu dữ liệu.
 * PHIÊN BẢN NÂNG CẤP: Xử lý TẤT CẢ các dự đoán, không chỉ cái chính.
 */
async function handlePredictionAndEnrichment(req: Request, predictionPromise: Promise<PredictionHistoryDoc>, userId?: string) {
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
  let collectionStatus: any = null;
  if (userId && breedSlugs.length > 0) {
    const userObjectId = new Types.ObjectId(userId);
    // Lấy thông tin user và số lượng collection cũ CÙNG LÚC
    const [userBeforeUpdate, oldCollections] = await Promise.all([
      userService.getById(userId),
      collectionService.getUserCollection(userObjectId)
    ]);
    if (!userBeforeUpdate) throw new BadRequestError("User not found before update.");
    const oldCollectionCount = oldCollections.length;

    // Thêm tất cả giống chó mới phát hiện vào bộ sưu tập
    await collectionService.addOrUpdateManyCollections(userObjectId, breedSlugs);

    // Lấy lại thông tin user và collection mới sau khi cập nhật
    const [userAfterUpdate, newCollections] = await Promise.all([
      userService.getById(userId),
      collectionService.getUserCollection(userObjectId)
    ]);
    if (!userAfterUpdate) throw new BadRequestError("User not found after update.");

    const achievementsResult = await achievementService.processUserAchievements(userAfterUpdate, newCollections);
    const unlockedAchievements = achievementsResult.filter(ach => ach.unlocked && !userBeforeUpdate?.achievements.some((oldAch: UnlockedAchievement) => oldAch.key === ach.key));

    collectionStatus = {
      isNewBreed: newCollections.length > oldCollectionCount, // So sánh với số lượng collection cũ đã lưu
      totalCollected: newCollections.length,
      achievementsUnlocked: unlockedAchievements.map(ach => ach.key)
    };
  }

  // 4. Chuyển đổi URL media trong kết quả
  const transformedPrediction = transformMediaURLs(req, predictionResult.toObject());

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
      // Làm giàu thông tin chi tiết cho từng con chó
      breedInfo: createEnrichedBreedInfo(breedInfoDoc),
    };
  });

  // 6. Xây dựng response cuối cùng theo cấu trúc mới
  const finalResponse = {
    predictionId: transformedPrediction.id,
    processedMediaUrl: transformedPrediction.processedMediaUrl, // Đã là URL tuyệt đối từ transformMediaURLs
    detections: detections, // Trả về mảng các dự đoán đã xử lý
    collectionStatus: collectionStatus,
  };

  return finalResponse;
}

export const bffPredictionController = {
  // `predictImage` và `predictVideo` không cần thay đổi vì logic đã nằm trong hàm helper
  predictImage: async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const file = req.file;
    if (!file) throw new BadRequestError("Không có file nào được cung cấp.");

    const predictionPromise = predictionService.makePrediction(userId, file, "image", req);
    const data = await handlePredictionAndEnrichment(req, predictionPromise, userId?.toString()); // Giữ nguyên userId string cho logic hiện tại
    res.status(200).json(data);
  },

  predictVideo: async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const file = req.file;
    if (!file) throw new BadRequestError("Không có file nào được cung cấp.");

    const predictionPromise = predictionService.makePrediction(userId, file, "video", req);
    const data = await handlePredictionAndEnrichment(req, predictionPromise, userId?.toString()); // Giữ nguyên userId string cho logic hiện tại
    res.status(200).json(data);
  },

  // `predictBatch` được cập nhật để có cấu trúc output nhất quán
  predictBatch: async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new BadRequestError("Không có file nào được cung cấp.");
    }

    // 1. Gọi service lõi để dự đoán hàng loạt
    const batchPredictionResults = await predictionService.makeBatchPredictions(userId, files, req);

    // 2. Thu thập TẤT CẢ các slug duy nhất từ TẤT CẢ các ảnh để làm giàu một lần duy nhất
    const allSlugs = batchPredictionResults.flatMap(result => result.predictions.map(p => p.class.toLowerCase().replace(/\s+/g, '-')));
    const uniqueSlugs: string[] = [...new Set(allSlugs)];

    // 3. Làm giàu dữ liệu song song để tối ưu hiệu suất
    let wikiInfoMap = new Map<string, DogBreedWikiDoc>();
    let collectionStatus: any = null; // Collection status được tính chung cho cả batch

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
          const oldCollectionCount = oldCollections.length;

          await collectionService.addOrUpdateManyCollections(userObjectId, uniqueSlugs);

          const [userAfterUpdate, newCollections] = await Promise.all([
            userService.getById(userObjectId.toString()),
            collectionService.getUserCollection(userObjectId)
          ]);
          if (!userAfterUpdate) return;

          const achievementsResult = await achievementService.processUserAchievements(userAfterUpdate, newCollections); // userAfterUpdate đã là PlainUser
          const unlockedAchievements = achievementsResult.filter(ach => ach.unlocked && !userBeforeUpdate.achievements.some((oldAch: UnlockedAchievement) => oldAch.key === ach.key));
          collectionStatus = {
            isNewBreed: newCollections.length > oldCollectionCount, // So sánh với số lượng collection cũ đã lưu
            totalCollected: newCollections.length,
            achievementsUnlocked: unlockedAchievements.map(ach => ach.key)
          };
        })()
      );
    }

    await Promise.all(enrichmentPromises);

    // 4. Xây dựng kết quả cuối cùng cho từng ảnh trong batch
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
        processedMediaUrl: transformedPrediction.processedMediaUrl, // Already an absolute URL
        detections: detections,
        collectionStatus: collectionStatus // Status chung cho cả batch
      };
    });

    res.status(200).json(results);
  },

  submitFeedback: async (req: Request, res: Response) => {
    const userId = req.user?._id; // Can be optional
    const { id: predictionId } = req.params;
    const { isCorrect, submittedLabel, notes } = req.body;

    const result = await feedbackService.submitFeedback(userId, { predictionId, isCorrect, submittedLabel, notes });

    // Logic to check if this is a new breed alert can be added here or in the service
    const newBreedAlert = !isCorrect && submittedLabel; // Simplified logic

    res.status(201).json({ feedbackId: (result as any)._id, message: 'Feedback submitted successfully', newBreedAlert });
  },

  getPredictionHistory: async (req: Request, res: Response, next: NextFunction) => {
    // This endpoint is now less critical as profile endpoint can aggregate this.
    // However, if a dedicated history page is needed, we can implement it here.
    // For now, we can point to the existing core service.
    // Note: Using require() inside a function is not a good practice.
    // It's better to import at the top level.
    // For now, let's just forward the request.
    return predictionHistoryController.getHistoryForCurrentUser(req, res);
  },

  /**
   * Xử lý kết nối WebSocket cho dự đoán stream.
   * Thay vì proxy trực tiếp, BFF sẽ làm trung gian để làm giàu dữ liệu.
   */
  handleStreamPrediction: async (ws: WebSocket, req: Request) => {
    const userId = req.user?._id?.toString(); // Sử dụng optional chaining an toàn
    const aiServiceUrl = (process.env.AI_SERVICE_URL || "http://localhost:8000").replace(/^http/, 'ws');
    const aiServiceWs = new WebSocket(`${aiServiceUrl}/predict-stream`);

    // Cache thông tin wiki để giảm truy vấn DB
    const wikiCache = new Map<string, any>();
    let finalResultSent = false; // Cờ để theo dõi xem kết quả cuối cùng đã được gửi chưa

    // --- FIX/Tối ưu hóa: Hàm phụ trợ để tạo Request Mock cho handlePredictionAndEnrichment ---
    const createMockRequest = () => {
        const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
        const host = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string);
        
        return {
            protocol: protocol,
            get: (header: string) => {
                if (header.toLowerCase() === 'host') return host;
                return req.headers[header.toLowerCase()]; 
            },
            // Thêm các trường cần thiết khác nếu có
        } as unknown as Request;
    }
    // ------------------------------------------------------------------------------------------

    // 1. Xử lý khi có kết nối thành công đến AI service
    aiServiceWs.on('open', () => {
      logger.info(`[BFF-WS] Established WebSocket connection to AI Service for user: ${userId || 'guest'}`);
      // Gửi một tin nhắn "ping" để giữ kết nối sống và phá vỡ trạng thái chờ đợi ban đầu.
      if (aiServiceWs.readyState === WebSocket.OPEN) aiServiceWs.send(JSON.stringify({ type: 'ping' }));
    });

    // 2. Lắng nghe message từ AI Service (kết quả dự đoán thô)
    aiServiceWs.on('message', async (message: WebSocket.Data) => {
      try {
        const data = JSON.parse(message.toString());
        
        // FIX: Chỉ sử dụng 'detections', loại bỏ '|| data.predictions'
        const detectionsList = data.detections; 

        if (data && Array.isArray(detectionsList)) {
          // Trích xuất các slug chưa có trong cache
          const slugsToFetch = [...new Set(
            detectionsList
              .map((p: any) => p.class.toLowerCase().replace(/\s+/g, '-'))
              .filter((slug: string) => !wikiCache.has(slug))
          )] as string[];

          // Nếu có slug mới, truy vấn và cập nhật cache
          if (slugsToFetch.length > 0) {
            const breeds = await wikiService.getBreedsBySlugs(slugsToFetch);
            breeds.forEach(breed => wikiCache.set(breed.slug, breed.toObject()));
          }

          // --- THAY ĐỔI LOGIC: Xử lý "captured" và "detections" khác nhau ---
          if (data.status === 'captured') {
            // 1. Nếu là kết quả "captured", gọi service để lưu nó vào DB
            logger.info(`[BFF-WS] Received 'captured' result. Saving to database...`);

            const mockReq = createMockRequest();

            const predictionPromise = predictionService.saveStreamPrediction(
              userId ? new Types.ObjectId(userId) : undefined, 
              data, // Data đã bao gồm processed_media_base64
              mockReq
            );
            
            // 2. Dùng hàm helper để làm giàu dữ liệu và gửi kết quả cuối cùng
            const finalResponse = await handlePredictionAndEnrichment(mockReq, predictionPromise, userId);
            
            // 3. Gửi gói dữ liệu cuối cùng với cấu trúc rõ ràng để client xử lý chuyển trang
            ws.send(JSON.stringify({ status: 'redirect', payload: finalResponse }));
            finalResultSent = true; // Đánh dấu đã gửi kết quả cuối cùng

            // Đóng kết nối AI service sau khi gửi kết quả cuối cùng
            if (aiServiceWs.readyState === WebSocket.OPEN) {
                aiServiceWs.close(1000, "Final result sent to client");
            }
            
          } else {
            // Nếu là tin nhắn dự đoán thông thường, chỉ làm giàu và gửi đi
            const enrichedDetections = detectionsList.map((p: any) => {
              const slug = p.class.toLowerCase().replace(/\s+/g, '-');
              const breedInfoDoc = wikiCache.get(slug);
              // Lưu ý: Dữ liệu boundingBox đã được định dạng chuẩn trong AI service
              return { 
                detectedBreed: slug, 
                confidence: p.confidence, 
                boundingBox: { 
                  x: p.box[0], 
                  y: p.box[1], 
                  width: p.box[2] - p.box[0], 
                  height: p.box[3] - p.box[1] 
                }, 
                breedInfo: createEnrichedBreedInfo(breedInfoDoc) 
              };
            });
            ws.send(JSON.stringify({ detections: enrichedDetections }));
          }
        } else {
          // Nếu không phải định dạng dự đoán (ví dụ: tin nhắn 'status: waiting'), gửi thẳng về client
          ws.send(message.toString());
        }
      } catch (error) {
        logger.error('[BFF-WS] Error processing message from AI service:', error);
        ws.send(JSON.stringify({ error: 'Failed to process prediction data.' }));
        // Đóng kết nối nếu có lỗi nghiêm trọng
        if (aiServiceWs.readyState === WebSocket.OPEN) aiServiceWs.close(1001, "BFF internal error");
      }
    });

    // 3. Chuyển tiếp message từ Client (khung hình) đến AI Service
    ws.on('message', (message: WebSocket.Data) => {
      if (aiServiceWs.readyState === WebSocket.OPEN) {
        // Chuyển tiếp message (Buffer) thành string trước khi gửi đi.
        aiServiceWs.send(message.toString());
      }
    });

    // 4. Xử lý khi một trong hai kết nối bị đóng
    ws.on('close', () => {
      logger.info(`[BFF-WS] Client connection closed. Closing connection to AI Service.`);
      // Đóng kết nối AI Service nếu nó còn mở, trừ khi kết quả cuối cùng đã được gửi
      if (aiServiceWs.readyState === WebSocket.OPEN && !finalResultSent) aiServiceWs.close(1000, "Client closed BFF connection");
    });
    aiServiceWs.on('close', (code, reason) => {
      // Chỉ đóng kết nối với client nếu kết quả cuối cùng CHƯA được gửi.
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