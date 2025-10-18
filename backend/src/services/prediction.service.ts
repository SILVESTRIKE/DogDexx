
import { Request } from 'express';
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";

import { PredictionHistoryModel, PredictionHistoryDoc } from "../models/prediction_history.model";
import { UserModel } from "../models/user.model";
import { MediaModel } from "../models/medias.model";
import { DirectoryModel } from "../models/directory.model";
import { BadRequestError } from "../errors";
import { AnalyticsEventModel } from "../models/analytics_event.model";
import { StreamResultPayload, UserDoc, MediaDoc } from "../types/types";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export const predictionService = {
  getGuestUser: async () => {
    const guestEmail = "guest@dogbreedid.com";
    let guestUser = await UserModel.findOne({ email: guestEmail });

    if (!guestUser) {
      const hashedPassword = await bcrypt.hash("guestpassword", 10);
      guestUser = new UserModel({ username: "guest", email: guestEmail, password: hashedPassword, role: "user", verify: true });
      await guestUser.save();

      const directory = new DirectoryModel({ name: "guest", creator_id: guestUser._id });
      await directory.save();

      guestUser.directoryId = directory._id;
      await guestUser.save();
    }
    return guestUser;
  },

  makePrediction: async (
    userId: mongoose.Types.ObjectId | undefined,
    file: Express.Multer.File,
    type: "image" | "video"
  ): Promise<PredictionHistoryDoc> => {
    if (!file) {
      throw new BadRequestError("Không có file nào được cung cấp.");
    }

    const { path: mediaPath, originalname: originalFilename } = file;
    
    try {
        let directory_id: Types.ObjectId | undefined;
        if (userId) {
          const user = await UserModel.findById(userId);
          if (!user || !user.directory_id) throw new BadRequestError("Không tìm thấy thông tin thư mục người dùng.");
          directory_id = user.directory_id;
        }

        const newMedia = new MediaModel({
          name: originalFilename, mediaPath, creator_id: userId, directory_id, type,
        });
        
        const formData = new FormData();
        formData.append("file", fs.createReadStream(mediaPath), { filename: originalFilename });

        const endpoint = type === "image" ? "/predict/image" : "/predict/video";
        const response = await axios.post(`${AI_SERVICE_URL}${endpoint}`, formData, {
          headers: { ...formData.getHeaders() },
          timeout: type === 'video' ? 300000 : 180000, // Tăng timeout ảnh lên 3 phút (180s)
        }).catch(error => {
            console.error("Lỗi khi gọi AI Service:", error.response?.data || error.message);
            throw new BadRequestError("Không thể kết nối đến dịch vụ AI. Vui lòng thử lại sau.");
        });
        
        await newMedia.save();

        const predictionResult = response.data;
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
            eventName: 'SUCCESSFUL_TRIAL',
            fingerprint: (req as any).fingerprint?.hash, ip: req.ip, userAgent: req.headers['user-agent'],
          }).catch(err => console.error('Failed to log analytics event:', err));
        }

        const newPrediction = await PredictionHistoryModel.create({
          user: userId,
          media: newMedia._id,
          mediaPath: newMedia.mediaPath,
          predictions: predictionResult.predictions,
          processedMediaPath: publicUrl,
          modelUsed: `YOLOv8_${type}_upload`,
        });

        if (userId) {
          const updateField = type === 'image' ? { $inc: { photoUploadsThisWeek: 1 } } : { $inc: { videoUploadsThisWeek: 1 } };
          await UserModel.updateOne({ _id: userId }, updateField);
        }

        return await newPrediction.populate<{ media: MediaDoc, user: UserDoc }>([{ path: "user", select: "-password" }, { path: "media" }]);
    } finally {
        // Đảm bảo file tạm được xóa
        if (fs.existsSync(mediaPath)) {
            fs.unlinkSync(mediaPath);
        }
    }
  },

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
        eventName: 'SUCCESSFUL_TRIAL_STREAM',
        fingerprint: (req as any).fingerprint?.hash, ip: req.ip, userAgent: req.headers['user-agent'],
      }).catch(err => console.error('Failed to log analytics event:', err));
    }

    const newPrediction = await PredictionHistoryModel.create({
      user: userId,
      media: newMedia._id,
      mediaPath: publicUrl, // mediaPath gốc cũng là ảnh đã xử lý
      predictions: payload.detections,
      processedMediaPath: publicUrl,
      modelUsed: `YOLOv8_stream`,
    });

    if (userId) {
      await UserModel.updateOne({ _id: userId }, { $inc: { photoUploadsThisWeek: 1 } });
    }
    
    // Trả về document đã được populate đầy đủ
    return await newPrediction.populate<{ media: MediaDoc, user: UserDoc }>([{ path: "user", select: "-password" }, { path: "media" }]);
  }
};