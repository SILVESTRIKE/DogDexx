import { Request } from 'express';
import axios from "axios";
import FormData from "form-data";
import path from "path";
import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';
import { UploadApiResponse } from 'cloudinary';
// THAY ĐỔI: Import cloudinary để có thể upload
import { cloudinary } from '../config/cloudinary.config'; 

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

    let directory_id: Types.ObjectId | undefined;
    if (userId) {
      const userDirectory = await DirectoryModel.findOne({ creator_id: userId, parent_id: null });
      if (!userDirectory) throw new BadRequestError("Không tìm thấy thư mục người dùng.");
      directory_id = userDirectory._id;
    }

    const activeModel = await AIModelService.findActiveModelForTask("DOG_BREED_CLASSIFICATION");
    const modelName = activeModel ? activeModel.name : 'unknown_model';

    // THAY ĐỔI: Gửi URL đến AI Service thay vì stream file
    // Lưu ý: AI Service của bạn cần được cập nhật để chấp nhận một danh sách các URL
    const response = await axios.post(`${AI_SERVICE_URL}/predict/images_by_urls`, {
        urls: files.map(file => file.path) // file.path bây giờ là URL Cloudinary
    }).catch(error => {
      console.error("Lỗi khi gọi AI Service:", error.response?.data || error.message);
      throw new BadRequestError("Không thể kết nối đến dịch vụ AI.");
    });

    // // Code cũ gửi file stream
    // const formData = new FormData();
    // files.forEach(file => {
    //   formData.append("files", fs.createReadStream(file.path), { filename: file.originalname });
    // });
    // const response = await axios.post(`${AI_SERVICE_URL}/predict/images`, formData, {
    //   headers: { ...formData.getHeaders() },
    //   timeout: 180000,
    // }).catch(error => { ... });

    const batchResults = response.data.results;
    const predictions: PredictionHistoryDoc[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = batchResults[i];
      
      // THAY ĐỔI: Xây dựng mediaPath để lưu vào DB từ public_id (file.filename)
      const extension = path.extname(file.originalname);
      const mediaPathForDb = `${file.filename}${extension}`;

      const newMedia = new MediaModel({
        name: file.originalname, 
        mediaPath: mediaPathForDb, // << Lưu đường dẫn tương đối giống hệt cấu trúc cũ
        creator_id: userId, 
        directory_id, 
        type: 'image',
      });
      await newMedia.save();

      // // Code cũ lưu mediaPath từ file.path cục bộ
      // const newMedia = new MediaModel({
      //   name: file.originalname, mediaPath: file.path, creator_id: userId, directory_id, type: 'image',
      // });

      if (!result?.predictions || !result?.processed_media_base64) {
        console.error(`Kết quả không hợp lệ cho file ${file.originalname}`);
        continue;
      }

      // THAY ĐỔI: Upload ảnh đã xử lý lên Cloudinary
      const processedMediaPathForDb = await uploadBase64ToCloudinary(
          result.processed_media_base64,
          'public/processed/images'
      );
      
      // // Code cũ ghi file đã xử lý ra đĩa
      // const base64Data = result.processed_media_base64;
      // const mediaBuffer = Buffer.from(base64Data, 'base64');
      // const uniqueFilename = `${uuidv4()}.jpg`;
      // const publicDir = path.join(__dirname, `../../public/processed/images`);
      // const publicUrl = `/public/processed/images/${uniqueFilename}`;
      // fs.mkdirSync(publicDir, { recursive: true });
      // fs.writeFileSync(path.join(publicDir, uniqueFilename), mediaBuffer);

      const newPrediction = await PredictionHistoryModel.create({
        user: userId, 
        media: newMedia._id, 
        mediaPath: newMedia.mediaPath,
        predictions: result.predictions, 
        processedMediaPath: processedMediaPathForDb, // << Lưu đường dẫn tương đối từ Cloudinary
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

    // --- BẮT ĐẦU TỐI ƯU HÓA SONG SONG ---

    // Tác vụ 1: Gửi file buffer trực tiếp cho AI Service
    const sendToAIService = async () => {
        const formData = new FormData();
        // Gửi buffer thay vì đọc từ đĩa
        formData.append("file", file.buffer, { filename: file.originalname });
        
        const endpoint = type === 'image' ? '/predict/image' : '/predict/video';
        const response = await axios.post(`${AI_SERVICE_URL}${endpoint}`, formData, {
            headers: { ...formData.getHeaders() },
            timeout: 300000, // 5 phút timeout
        });
        return response.data;
    };

    // Tác vụ 2: Upload file gốc (buffer) lên Cloudinary
    const uploadOriginalToCloudinary = async () => {
        // Tạo public_id cho file gốc
        const timestamp = Date.now();
        const filenameWithoutExt = `${path.parse(file.originalname).name}_${timestamp}`;
        const folder = `public/uploads/${type}s`; // ví dụ: public/uploads/images
        
        const result = await uploadBufferToCloudinary(file.buffer, filenameWithoutExt, folder, type);
        
        // Trả về đường dẫn tương đối để lưu vào DB
        return `${result.public_id}.${result.format}`;
    };

    // Chạy cả 2 tác vụ cùng lúc và chờ cả hai hoàn thành
    console.log("Bắt đầu xử lý AI và upload file gốc song song...");
    const [predictionResult, originalMediaPathForDb] = await Promise.all([
        sendToAIService(),
        uploadOriginalToCloudinary()
    ]);
    console.log("Xử lý AI và upload file gốc đã hoàn tất.");

    if (!predictionResult?.predictions || !predictionResult?.processed_media_base64) {
      throw new Error("Kết quả từ AI service không hợp lệ.");
    }
    
    // --- KẾT THÚC TỐI ƯU HÓA ---

    // Lưu media gốc vào DB
    const newMedia = new MediaModel({
      name: file.originalname,
      mediaPath: originalMediaPathForDb, // << Dùng kết quả từ Tác vụ 2
      creator_id: userId,
      directory_id,
      type,
    });
    await newMedia.save();
    
    // Tác vụ cuối: Upload file đã xử lý lên Cloudinary
    console.log("Đang upload file đã xử lý...");
    const processedFolder = `public/processed/${type}s`;
    const processedMediaPathForDb = await uploadBase64ToCloudinary(
        predictionResult.processed_media_base64,
        processedFolder,
        type
    );
    console.log("Upload file đã xử lý hoàn tất.");
    
    // // Code cũ ghi file ra đĩa
    // const base64Data = predictionResult.processed_media_base64;
    // const mediaBuffer = Buffer.from(base64Data, 'base64');
    // const fileExtension = type === 'video' ? 'mp4' : 'jpg';
    // const publicFolder = type === 'video' ? 'processed/videos' : 'processed/images';
    // const uniqueFilename = `${uuidv4()}.${fileExtension}`;
    // const publicDir = path.join(__dirname, `../../public/${publicFolder}`);
    // const publicUrl = `/public/${publicFolder}/${uniqueFilename}`;
    // fs.mkdirSync(publicDir, { recursive: true });
    // fs.writeFileSync(path.join(publicDir, uniqueFilename), mediaBuffer);
    
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