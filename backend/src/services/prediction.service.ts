import { Request } from 'express';
import axios from "axios";
import FormData from "form-data";
import path from "path";
import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';
import { UploadApiResponse } from 'cloudinary';
// THAY ĐỔI: Import cloudinary để có thể upload
import { cloudinary } from '../config/cloudinary.config'; 
import { logger } from '../utils/logger.util';
import { PredictionHistoryModel, PredictionHistoryDoc, IYoloPrediction } from "../models/prediction_history.model";
import { UserDoc } from "../models/user.model";
import { DirectoryModel } from "../models/directory.model";
import { MediaModel, MediaDoc } from "../models/medias.model";
import { BadRequestError } from "../errors";
import { AnalyticsEventName } from '../constants/analytics.constants';
import { BatchProcessor } from '../utils/BatchProcessor.util';
import { PREDICTION_SOURCES } from '../constants/prediction.constants';
import { analyticsService } from './analytics.service';
import { AIModelService } from './ai_models.service';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

interface StreamResultPayload {
  processed_media_base64: string;
  media_type: string;
  detections: IYoloPrediction[];
}

// THAY ĐỔI: Hàm helper mới để upload file base64 lên Cloudinary
/**
 * Uploads a base64 encoded media to Cloudinary.
 * @param base64Data The base64 string of the media.
 * @param folder The target folder in Cloudinary (e.g., 'public/processed/images').
 * @param resource_type The type of media, 'image' or 'video'.
 * @returns The relative path (public_id + extension) to be saved in the database.
 */
const uploadBase64ToCloudinary = async (base64Data: string, folder: string, resource_type: "image" | "video" = "image"): Promise<string> => {
    const dataUri = `data:${resource_type === 'video' ? 'video/mp4' : 'image/jpeg'};base64,${base64Data}`;
    const result = await cloudinary.uploader.upload(dataUri, {
        folder: folder,
        resource_type: resource_type,
    });
    // Trả về public_id đầy đủ bao gồm cả folder, ví dụ: "public/processed/images/random_id"
    // Ghép với format để có đường dẫn hoàn chỉnh, ví dụ: "public/processed/images/random_id.jpg"
    return `${result.public_id}.${result.format}`;
};

// THÊM: Hàm helper để upload buffer lên Cloudinary
const uploadBufferToCloudinary = async (buffer: Buffer, public_id_without_ext: string, folder: string, resource_type: "image" | "video" = "image"): Promise<UploadApiResponse> => {
    return new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                public_id: public_id_without_ext,
                resource_type: resource_type,
            },
            (error, result) => {
                if (result) resolve(result);
                else reject(error);
            }
        );
        stream.end(buffer);
    });
};



const batchProcessor = new BatchProcessor(8, 200);

export const predictionService = {
  getPredictionStatus: async (predictionId: string) => {
    return batchProcessor.getProgress(predictionId);
  },


  makeBatchPredictions: async (
    userId: Types.ObjectId | undefined,
    files: Express.Multer.File[],
    req: Request
  ): Promise<PredictionHistoryDoc[]> => {
    if (!files.length) throw new BadRequestError("Không có file nào được cung cấp.");

    // ================= SỬA LỖI: Bọc trong try...catch =================
    try {
        let directory_id: Types.ObjectId | undefined;
        if (userId) {
            const userDirectory = await DirectoryModel.findOne({ creator_id: userId, parent_id: null });
            if (!userDirectory) throw new BadRequestError("Không tìm thấy thư mục người dùng.");
            directory_id = userDirectory._id;
        }

        const activeModel = await AIModelService.findActiveModelForTask("DOG_BREED_CLASSIFICATION");
        const modelName = activeModel ? activeModel.name : 'unknown_model';

        const response = await axios.post(`${AI_SERVICE_URL}/predict/images_by_urls`, {
            urls: files.map(file => file.path)
        });

        const batchResults = response.data.results;
        const predictions: PredictionHistoryDoc[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const result = batchResults[i];
            
            const extension = path.extname(file.originalname);
            const mediaPathForDb = `${file.filename}${extension}`;

            const newMedia = new MediaModel({
                name: file.originalname, 
                mediaPath: mediaPathForDb,
                creator_id: userId, 
                directory_id, 
                type: 'image',
            });
            await newMedia.save();

            if (!result?.predictions || !result?.processed_media_base64) {
                logger.error(`[PredictionService] Kết quả không hợp lệ cho file (batch) ${file.originalname}`);
                continue;
            }

            const processedMediaPathForDb = await uploadBase64ToCloudinary(
                result.processed_media_base64,
                'public/processed/images'
            );
            
            const newPrediction = await PredictionHistoryModel.create({
                user: userId, 
                media: newMedia._id, 
                mediaPath: newMedia.mediaPath,
                predictions: result.predictions, 
                processedMediaPath: processedMediaPathForDb,
                modelUsed: modelName, 
                source: PREDICTION_SOURCES.IMAGE_UPLOAD,
            });

            const populatedPrediction = await newPrediction.populate<{ media: MediaDoc, user: UserDoc }>([
                { path: "user", select: "-password" },
                { path: "media" }
            ]);
            predictions.push(populatedPrediction);
        }

        analyticsService.trackEvent({
            eventName: userId ? AnalyticsEventName.SUCCESSFUL_PREDICTION : AnalyticsEventName.SUCCESSFUL_TRIAL,
            req,
            eventData: { fileCount: files.length }
        });

        return predictions;

    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            logger.error(`[PredictionService] Lỗi Axios khi gọi AI Service (batch): ${error.message}`);
            logger.error(`[PredictionService] Phản hồi từ AI Service (nếu có):`, error.response?.data);
        } else {
            logger.error(`[PredictionService] Lỗi không xác định trong makeBatchPredictions:`, error);
        }
        throw new Error("Không thể xử lý dự đoán hàng loạt do có lỗi từ dịch vụ AI.");
    }
    // ================= KẾT THÚC SỬA LỖI =================
  },

  makePrediction: async (
    userId: Types.ObjectId | undefined,
    file: Express.Multer.File,
    type: "image" | "video",
    req: Request
  ): Promise<PredictionHistoryDoc> => {
    if (!file) throw new BadRequestError("Không có file nào được cung cấp.");
    
    let directory_id: Types.ObjectId | undefined;
    if (userId) {
      const userDirectory = await DirectoryModel.findOne({ creator_id: userId, parent_id: null });
      if (!userDirectory) throw new BadRequestError("Không tìm thấy thư mục người dùng.");
      directory_id = userDirectory._id;
    }
    
    const activeModel = await AIModelService.findActiveModelForTask("DOG_BREED_CLASSIFICATION");
    const modelName = activeModel ? activeModel.name : 'unknown_model';

    // ================= SỬA LỖI: Bọc trong try...catch =================
    try {
        const sendToAIService = async () => {
            const formData = new FormData();
            formData.append("file", file.buffer, { filename: file.originalname });
            
            const endpoint = type === 'image' ? '/predict/image' : '/predict/video';
            const response = await axios.post(`${AI_SERVICE_URL}${endpoint}`, formData, {
                headers: { ...formData.getHeaders() },
                timeout: 300000,
            });
            return response.data;
        };

        const uploadOriginalToCloudinary = async () => {
            const timestamp = Date.now();
            const filenameWithoutExt = `${path.parse(file.originalname).name}_${timestamp}`;
            const folder = `public/uploads/${type}s`;
            
            const result = await uploadBufferToCloudinary(file.buffer, filenameWithoutExt, folder, type);
            return `${result.public_id}.${result.format}`;
        };

        console.log("Bắt đầu xử lý AI và upload file gốc song song...");
        const [predictionResult, originalMediaPathForDb] = await Promise.all([
            sendToAIService(),
            uploadOriginalToCloudinary()
        ]);
        console.log("Xử lý AI và upload file gốc đã hoàn tất.");

        if (!predictionResult?.predictions || !predictionResult?.processed_media_base64) {
          throw new Error("Kết quả từ AI service không hợp lệ.");
        }

        const newMedia = new MediaModel({
          name: file.originalname,
          mediaPath: originalMediaPathForDb,
          creator_id: userId,
          directory_id,
          type,
        });
        await newMedia.save();
        
        console.log("Đang upload file đã xử lý...");
        const processedFolder = `public/processed/${type}s`;
        const processedMediaPathForDb = await uploadBase64ToCloudinary(
            predictionResult.processed_media_base64,
            processedFolder,
            type
        );
        console.log("Upload file đã xử lý hoàn tất.");
        
        analyticsService.trackEvent({
          eventName: userId ? AnalyticsEventName.SUCCESSFUL_PREDICTION : AnalyticsEventName.SUCCESSFUL_TRIAL,
          req,
          eventData: { mediaType: type, filename: file.originalname }
        });

        const newPrediction = await PredictionHistoryModel.create({
          user: userId, 
          media: newMedia._id, 
          mediaPath: newMedia.mediaPath,
          predictions: predictionResult.predictions, 
          processedMediaPath: processedMediaPathForDb,
          modelUsed: modelName, 
          source: `${type}_upload` as any,
        });
        
        return newPrediction.populate<{ media: MediaDoc, user: UserDoc }>([{ path: "user", select: "-password" }, { path: "media" }]);

    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            logger.error(`[PredictionService] Lỗi Axios khi gọi AI Service: ${error.message}`);
            logger.error(`[PredictionService] Phản hồi từ AI Service (nếu có):`, error.response?.data);
        } else {
            logger.error(`[PredictionService] Lỗi không xác định trong makePrediction:`, error);
        }
        
        throw new Error("Không thể xử lý dự đoán do có lỗi từ dịch vụ AI.");
    }
    // ================= KẾT THÚC SỬA LỖI =================
  },
  saveStreamPrediction: async (
    userId: Types.ObjectId | undefined,
    payload: StreamResultPayload,
    req: Request
  ): Promise<PredictionHistoryDoc> => {
    if (!payload || !payload.processed_media_base64 || !payload.detections) {
      throw new BadRequestError("Dữ liệu kết quả stream không hợp lệ.");
    }

    const activeModel = await AIModelService.findActiveModelForTask("DOG_BREED_CLASSIFICATION");
    const modelName = activeModel ? activeModel.name : 'unknown_model';

    // THAY ĐỔI: Upload ảnh stream lên Cloudinary
    const processedMediaPathForDb = await uploadBase64ToCloudinary(
        payload.processed_media_base64,
        'public/processed/images',
        'image'
    );
    
    // // Code cũ ghi file ra đĩa
    // const base64Data = payload.processed_media_base64;
    // const mediaBuffer = Buffer.from(base64Data, 'base64');
    // const uniqueFilename = `${uuidv4()}.jpg`;
    // const publicDir = path.join(__dirname, `../../public/processed/images`);
    // const publicUrl = `/public/processed/images/${uniqueFilename}`;
    // fs.mkdirSync(publicDir, { recursive: true });
    // fs.writeFileSync(path.join(publicDir, uniqueFilename), mediaBuffer);
    
    let directory_id: Types.ObjectId | undefined;
    if (userId) {
      const userDirectory = await DirectoryModel.findOne({ creator_id: userId, parent_id: null });
      if (userDirectory) directory_id = userDirectory._id;
    }
    
    const newMedia = await MediaModel.create({
      name: `Stream Capture - ${new Date().toISOString()}`,
      mediaPath: processedMediaPathForDb, // << Lưu đường dẫn từ Cloudinary
      creator_id: userId, 
      directory_id, 
      type: 'image',
    });

    analyticsService.trackEvent({ 
      eventName: userId ? AnalyticsEventName.SUCCESSFUL_PREDICTION : AnalyticsEventName.SUCCESSFUL_TRIAL, 
      req 
    });

    const newPrediction = await PredictionHistoryModel.create({
      user: userId, 
      media: newMedia._id, 
      mediaPath: processedMediaPathForDb,
      predictions: payload.detections, 
      processedMediaPath: processedMediaPathForDb, // Dùng chung vì không có file gốc
      modelUsed: modelName, 
      source: PREDICTION_SOURCES.STREAM_CAPTURE,
    });

    return newPrediction.populate<{ media: MediaDoc, user: UserDoc }>([{ path: "user", select: "-password" }, { path: "media" }]);
  },
};