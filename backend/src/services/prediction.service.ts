// predict.service.ts
import { Request } from 'express';
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';

import { PredictionHistoryModel, PredictionHistoryDoc, IYoloPrediction } from "../models/prediction_history.model";
import { UserModel, UserDoc} from "../models/user.model";
import { MediaModel, MediaDoc} from "../models/medias.model";
import { AnalyticsEventModel } from '../models/analytics_event.model';
import { BadRequestError } from "../errors";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

interface StreamResultPayload {
  processed_media_base64: string;
  media_type: string;
  detections: IYoloPrediction[];
}
import { BatchProcessor } from '../utils/BatchProcessor.util';

const batchProcessor = new BatchProcessor(8, 200);

export const predictionService = {
  getPredictionStatus: async (predictionId: string) => {
    return batchProcessor.getProgress(predictionId);
  },
  /**
   * Xử lý nhiều file ảnh cùng lúc, gửi đến AI service để dự đoán theo batch.
   */
  makeBatchPredictions: async (
    userId: Types.ObjectId | undefined,
    files: Express.Multer.File[],
    req: Request
  ): Promise<PredictionHistoryDoc[]> => {
    if (!files.length) throw new BadRequestError("Không có file nào được cung cấp.");

    const tempFilePaths = files.map(file => file.path);
    let directory_id: Types.ObjectId | undefined;
    if (userId) {
      const user = await UserModel.findById(userId);
      if (!user || !user.directory_id) throw new BadRequestError("Không tìm thấy thông tin thư mục người dùng.");
      directory_id = user.directory_id;
    }

      // Tạo form-data với nhiều file
      const formData = new FormData();
      files.forEach(file => {
        formData.append("files", fs.createReadStream(file.path), { filename: file.originalname });
      });

      // Gọi API batch prediction
      const response = await axios.post(`${AI_SERVICE_URL}/predict/images`, formData, {
        headers: { ...formData.getHeaders() },
        timeout: 180000, // Tăng lên 3 phút (180s) cho batch ảnh
      }).catch(error => {
        console.error("Lỗi khi gọi AI Service:", error.response?.data || error.message);
        throw new BadRequestError("Không thể kết nối đến dịch vụ AI. Vui lòng thử lại sau.");
      });

      const batchResults = response.data.results;
      const predictions: PredictionHistoryDoc[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = batchResults[i];
        
        const newMedia = new MediaModel({
          name: file.originalname,
          mediaPath: file.path,
          creator_id: userId,
          directory_id,
          type: 'image',
        });
        await newMedia.save();

        if (!result?.predictions || !result?.processed_media_base64) {
          console.error(`Kết quả không hợp lệ cho file ${file.originalname}`);
          continue;
        }

        const base64Data = result.processed_media_base64;
        const mediaBuffer = Buffer.from(base64Data, 'base64');
        
        const uniqueFilename = `${uuidv4()}.jpg`;
        const publicDir = path.join(__dirname, `../../public/processed-images`);
        const publicUrl = `/public/processed-images/${uniqueFilename}`;

        fs.mkdirSync(publicDir, { recursive: true });
        fs.writeFileSync(path.join(publicDir, uniqueFilename), mediaBuffer);

        const newPrediction = await PredictionHistoryModel.create({
          user: userId,
          media: newMedia._id,
          mediaPath: newMedia.mediaPath,
          predictions: result.predictions,
          processedMediaPath: publicUrl,
          modelUsed: 'YOLOv8_image_batch',
          source: 'image_upload',
        });

        const populatedPrediction = await newPrediction.populate<{ media: MediaDoc, user: UserDoc }>([
          { path: "user", select: "-password" },
          { path: "media" }
        ]);

        predictions.push(populatedPrediction);
      }

      if (!userId) {
        AnalyticsEventModel.create({
          eventName: 'SUCCESSFUL_TRIAL_BATCH', // Đã hợp lệ sau khi sửa model
          fingerprint: (req as any).fingerprint?.hash,
          ip: req.ip, // Thêm dấu phẩy
          userAgent: req.headers['user-agent'], // Thêm dấu phẩy
        }).catch(err => console.error('Failed to log analytics event:', err));
      }

      if (userId) {
        await UserModel.updateOne(
          { _id: userId },
          { $inc: { photoUploadsThisWeek: files.length } }
        );
      }

    return predictions;
  },
  /**
   * Xử lý một file upload, gửi đến AI service để dự đoán, và lưu kết quả.
   */
  makePrediction: async (
    userId: Types.ObjectId | undefined,
    file: Express.Multer.File,
    type: "image" | "video",
    req: Request
  ): Promise<PredictionHistoryDoc> => {
    if (!file) throw new BadRequestError("Không có file nào được cung cấp.");

    const { path: physicalPath, originalname: originalFilename } = file;
    let directory_id: Types.ObjectId | undefined;
    if (userId) {
      const user = await UserModel.findById(userId);
      if (!user || !user.directory_id) throw new BadRequestError("Không tìm thấy thông tin thư mục người dùng.");
      directory_id = user.directory_id;
    }

    // SỬA LỖI: Chuyển đổi đường dẫn vật lý thành URL có thể truy cập
    // physicalPath có dạng 'uploads\image\2024\05\filename.jpg'
    // SỬA LỖI: Chỉ lưu đường dẫn tương đối (bắt đầu từ 'uploads'), không bao gồm '/public'.
    const mediaUrl = physicalPath.replace(/\\/g, '/');

    const newMedia = new MediaModel({
      name: originalFilename, mediaPath: mediaUrl, creator_id: userId, directory_id, type,
    });
    await newMedia.save();

    let predictionResult;

    // *** THAY ĐỔI QUAN TRỌNG: SỬ DỤNG BATCH PROCESSOR CHO ẢNH ***
    if (type === 'image') {
      const predictionId = uuidv4(); // Tạo ID tạm thời để theo dõi
      predictionResult = await batchProcessor.add({
        id: predictionId,
        userId,
        file,
        mediaType: 'image',
        resolve: () => {}, // Sẽ được BatchProcessor ghi đè
        reject: () => {},  // Sẽ được BatchProcessor ghi đè
      });
    } else { // Giữ nguyên logic cũ cho video
      const formData = new FormData();
      formData.append("file", fs.createReadStream(physicalPath), { filename: originalFilename });
      const response = await axios.post(`${AI_SERVICE_URL}/predict/video`, formData, {
        headers: { ...formData.getHeaders() },
        timeout: 300000,
      });
      predictionResult = response.data;
    }

        if (!predictionResult?.predictions || !predictionResult?.processed_media_base64) {
          throw new Error("Kết quả từ AI service không hợp lệ.");
        }

        const base64Data = predictionResult.processed_media_base64;
        const mediaBuffer = Buffer.from(base64Data, 'base64');
        
        const fileExtension = type === 'video' ? 'mp4' : 'jpg';
        const publicFolder = type === 'video' ? 'processed-videos' : 'processed-images';
        
        const uniqueFilename = `${uuidv4()}.${fileExtension}`;
        const publicDir = path.join(__dirname, `../../public/${publicFolder}`);
        const publicUrl = `/public/${publicFolder}/${uniqueFilename}`;

        fs.mkdirSync(publicDir, { recursive: true });
        fs.writeFileSync(path.join(publicDir, uniqueFilename), mediaBuffer);
        
        if (!userId) {
          AnalyticsEventModel.create({
            eventName: 'SUCCESSFUL_TRIAL', // Đã hợp lệ sau khi sửa model
            fingerprint: (req as any).fingerprint?.hash,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          }).catch(err => console.error('Failed to log analytics event:', err));
        }

        const newPrediction = await PredictionHistoryModel.create({
          user: userId,
          media: newMedia._id,
          mediaPath: newMedia.mediaPath,
          predictions: predictionResult.predictions,
          processedMediaPath: publicUrl,
          modelUsed: `YOLOv8_${type}_upload`,
          source: `${type}_upload` as 'image_upload' | 'video_upload',
        });

        if (userId) {
          const updateField = type === 'image' ? { $inc: { photoUploadsThisWeek: 1 } } : { $inc: { videoUploadsThisWeek: 1 } };
          await UserModel.updateOne({ _id: userId }, updateField);
        }

        return await newPrediction.populate<{ media: MediaDoc, user: UserDoc }>([{ path: "user", select: "-password" }, { path: "media" }]);
  }, // <-- THÊM DẤU PHẨY QUAN TRỌNG Ở ĐÂY
  /**
   * Lưu kết quả từ một phiên dự đoán stream.
   */
  saveStreamPrediction: async (
    userId: Types.ObjectId | undefined,
    payload: StreamResultPayload,
    req: Request // Mock request
  ): Promise<PredictionHistoryDoc> => {
    if (!payload || !payload.processed_media_base64 || !payload.detections) {
      throw new BadRequestError("Dữ liệu kết quả stream không hợp lệ.");
    }

    // --- FIX: Logic lưu trữ và trả về PredictionHistoryDoc ---

    const base64Data = payload.processed_media_base64;
    const mediaBuffer = Buffer.from(base64Data, 'base64');
    
    const uniqueFilename = `${uuidv4()}.jpg`;
    const publicDir = path.join(__dirname, `../../public/processed-images`);
    const publicUrl = `/public/processed-images/${uniqueFilename}`;

    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(path.join(publicDir, uniqueFilename), mediaBuffer);
    
    let directory_id: Types.ObjectId | undefined;
    if (userId) {
      const user = await UserModel.findById(userId);
      if (user) directory_id = user.directory_id;
    }
    
    const newMedia = await MediaModel.create({
      name: `Stream Capture - ${new Date().toISOString()}`,
      mediaPath: publicUrl,
      creator_id: userId,
      directory_id: directory_id,
      type: 'image',
    });

    if (!userId) {
      AnalyticsEventModel.create({
        eventName: 'SUCCESSFUL_TRIAL_STREAM', // Đã hợp lệ sau khi sửa model
        fingerprint: (req as any).fingerprint?.hash,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(err => console.error('Failed to log analytics event:', err));
    }

    const newPrediction = await PredictionHistoryModel.create({
      user: userId,
      media: newMedia._id,
      mediaPath: publicUrl, // mediaPath gốc cũng là ảnh đã xử lý
      predictions: payload.detections,
      processedMediaPath: publicUrl,
      modelUsed: `YOLOv8_stream`,
      source: 'stream_capture',
    });

    if (userId) {
      await UserModel.updateOne({ _id: userId }, { $inc: { photoUploadsThisWeek: 1 } });
    }
    
    // Trả về document đã được populate đầy đủ
    return await newPrediction.populate<{ media: MediaDoc, user: UserDoc }>([{ path: "user", select: "-password" }, { path: "media" }]);
  },
};