// bff prediction_controller.ts
import { Request, Response } from "express";
import WebSocket from "ws";
import { Types } from "mongoose";
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
import { logger } from "../utils/logger";

/**
 * Hàm phụ trợ để tạo đối tượng breedInfo được làm giàu và chọn lọc.
 * @param breedInfoDoc Document từ Mongoose của DogBreedWiki.
 * @returns Một object chỉ chứa các trường cần thiết cho frontend.
 */
function createEnrichedBreedInfo(breedInfoDoc: DogBreedWikiDoc | null | undefined) {
  if (!breedInfoDoc) return null;
  return {
    // --- Cấp 1: Cốt lõi ---
    slug: breedInfoDoc.slug,
    group: breedInfoDoc.group,
    description: breedInfoDoc.description,
    life_expectancy: breedInfoDoc.life_expectancy,
    temperament: breedInfoDoc.temperament,
    energy_level: breedInfoDoc.energy_level,
    trainability: breedInfoDoc.trainability,
    shedding_level: breedInfoDoc.shedding_level,
    maintenance_difficulty: breedInfoDoc.maintenance_difficulty,
    // --- Cấp 2: Ngữ cảnh ---
    height: (breedInfoDoc as any).height,
    weight: (breedInfoDoc as any).weight,
    good_with_children: (breedInfoDoc as any).good_with_children,
    suitable_for: (breedInfoDoc as any).suitable_for,
  };
}
/**
 * Hàm phụ trợ để xử lý logic chung cho việc dự đoán và làm giàu dữ liệu.
 * PHIÊN BẢN NÂNG CẤP: Xử lý TẤT CẢ các dự đoán, không chỉ cái chính.
 */
async function handlePredictionAndEnrichment(req: Request, predictionPromise: Promise<PredictionHistoryDoc>, userId?: string) {
  // 1. Chờ kết quả dự đoán thô từ service lõi
  const predictionResult = await predictionPromise;

  // 2. Trích xuất các slug giống chó duy nhất từ TẤT CẢ các kết quả để chuẩn bị làm giàu
  const breedSlugs: string[] = [...new Set(predictionResult.predictions.map((p) => p.class.toLowerCase().replace(/\s+/g, '-')))];

  // Tạo một map để tra cứu thông tin wiki một cách hiệu quả
  let wikiInfoMap = new Map<string, DogBreedWikiDoc>();
  if (breedSlugs.length > 0) {
    const breeds = await wikiService.getBreedsBySlugs(breedSlugs);
    breeds.forEach(breed => wikiInfoMap.set(breed.slug, breed));
  }

  // 3. Nếu user đăng nhập, cập nhật bộ sưu tập và kiểm tra thành tích
  let collectionStatus: any = null;
  if (userId && breedSlugs.length > 0) {
    const userObjectId = new Types.ObjectId(userId);
    
    const oldCollectionSize = await UserCollectionModel.countDocuments({ user_id: userObjectId });

    // Thêm tất cả giống chó mới phát hiện vào bộ sưu tập
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
    const allSlugs = batchPredictionResults.flatMap(result =>
      result.predictions.map(p => p.class.toLowerCase().replace(/\s+/g, '-'))
    );
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
      const userObjectId = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;
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
    
    // 4. Xây dựng kết quả cuối cùng cho từng ảnh trong batch
    const results = batchPredictionResults.map(predictionResult => {
      const transformedPrediction = transformMediaURLs(req, predictionResult.toObject());

      // Tạo URL tuyệt đối
      const protocol = req.protocol;
      const host = req.get('host');
      const absoluteProcessedMediaUrl = `${protocol}://${host}${transformedPrediction.processedMediaUrl}`;
      
      const detections = transformedPrediction.predictions.map((p: any) => {
          const slug = p.class.toLowerCase().replace(/\s+/g, '-');
          const breedInfoDoc = wikiInfoMap.get(slug);
          return {
              detectedBreed: slug,
              confidence: p.confidence,
              boundingBox: { x: p.box[0], y: p.box[1], width: p.box[2] - p.box[0], height: p.box[3] - p.box[1] },
              // === ĐÃ ĐIỀN ĐẦY ĐỦ CẤU TRÚC CHI TIẾT VÀO ĐÂY ===
              breedInfo: breedInfoDoc ? {
                  // Cấp 1: Cốt lõi
                  slug: breedInfoDoc.slug,
                  group: breedInfoDoc.group,
                  description: breedInfoDoc.description,
                  life_expectancy: breedInfoDoc.life_expectancy,
                  temperament: breedInfoDoc.temperament,
                  energy_level: breedInfoDoc.energy_level,
                  trainability: breedInfoDoc.trainability,
                  shedding_level: breedInfoDoc.shedding_level,
                  maintenance_difficulty: breedInfoDoc.maintenance_difficulty,
                  
                  // Cấp 2: Ngữ cảnh lối sống
                  height: (breedInfoDoc as any).height,
                  weight: (breedInfoDoc as any).weight,
                  good_with_children: (breedInfoDoc as any).good_with_children,
                  suitable_for: (breedInfoDoc as any).suitable_for,
              } : null
          };
      });

      return {
        predictionId: transformedPrediction.id,
        originalFilename: (transformedPrediction.media as any)?.name || 'unknown',
        processedMediaUrl: absoluteProcessedMediaUrl,
        detections: detections,
        collectionStatus: collectionStatus // Status chung cho cả batch
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