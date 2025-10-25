import { Request } from 'express';
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from 'uuid';
import { Types } from 'mongoose';

import { PredictionHistoryModel, PredictionHistoryDoc, IYoloPrediction } from "../models/prediction_history.model";
import { UserDoc } from "../models/user.model";
import { DirectoryModel } from "../models/directory.model";
import { MediaModel, MediaDoc } from "../models/medias.model";
import { BadRequestError } from "../errors";
import { AnalyticsEventName } from '../constants/analytics.events';
import { BatchProcessor } from '../utils/BatchProcessor.util';
import { analyticsService } from './analytics.service';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

interface StreamResultPayload {
  processed_media_base64: string;
  media_type: string;
  detections: IYoloPrediction[];
}

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

    const formData = new FormData();
    files.forEach(file => {
      formData.append("files", fs.createReadStream(file.path), { filename: file.originalname });
    });

    const response = await axios.post(`${AI_SERVICE_URL}/predict/images`, formData, {
      headers: { ...formData.getHeaders() },
      timeout: 180000,
    }).catch(error => {
      console.error("Lỗi khi gọi AI Service:", error.response?.data || error.message);
      throw new BadRequestError("Không thể kết nối đến dịch vụ AI.");
    });

    const batchResults = response.data.results;
    const predictions: PredictionHistoryDoc[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = batchResults[i];
      
      const newMedia = new MediaModel({
        name: file.originalname, mediaPath: file.path, creator_id: userId, directory_id, type: 'image',
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
        user: userId, media: newMedia._id, mediaPath: newMedia.mediaPath,
        predictions: result.predictions, processedMediaPath: publicUrl,
        modelUsed: 'YOLOv8_image_batch', source: 'image_upload',
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

    const { path: physicalPath, originalname: originalFilename } = file;
    let directory_id: Types.ObjectId | undefined;
    if (userId) {
      const userDirectory = await DirectoryModel.findOne({ creator_id: userId, parent_id: null });
      if (!userDirectory) throw new BadRequestError("Không tìm thấy thư mục người dùng.");
      directory_id = userDirectory._id;
    }

    const mediaUrl = physicalPath.replace(/\\/g, '/');
    const newMedia = new MediaModel({
      name: originalFilename, mediaPath: mediaUrl, creator_id: userId, directory_id, type,
    });
    await newMedia.save();

    let predictionResult;

    if (type === 'image') {
      predictionResult = await batchProcessor.add({
        id: uuidv4(), userId, file, mediaType: 'image', resolve: () => {}, reject: () => {},
      });
    } else {
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
    
    analyticsService.trackEvent({
      eventName: userId ? AnalyticsEventName.SUCCESSFUL_PREDICTION : AnalyticsEventName.SUCCESSFUL_TRIAL,
      req,
      eventData: { mediaType: type, filename: originalFilename }
    });

    const newPrediction = await PredictionHistoryModel.create({
      user: userId, media: newMedia._id, mediaPath: newMedia.mediaPath,
      predictions: predictionResult.predictions, processedMediaPath: publicUrl,
      modelUsed: `YOLOv8_${type}_upload`, source: `${type}_upload` as 'image_upload' | 'video_upload',
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

    const base64Data = payload.processed_media_base64;
    const mediaBuffer = Buffer.from(base64Data, 'base64');
    const uniqueFilename = `${uuidv4()}.jpg`;
    const publicDir = path.join(__dirname, `../../public/processed-images`);
    const publicUrl = `/public/processed-images/${uniqueFilename}`;

    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(path.join(publicDir, uniqueFilename), mediaBuffer);
    
    let directory_id: Types.ObjectId | undefined;
    if (userId) {
      const userDirectory = await DirectoryModel.findOne({ creator_id: userId, parent_id: null });
      if (userDirectory) directory_id = userDirectory._id;
    }
    
    const newMedia = await MediaModel.create({
      name: `Stream Capture - ${new Date().toISOString()}`,
      mediaPath: publicUrl, creator_id: userId, directory_id, type: 'image',
    });

    analyticsService.trackEvent({ 
      eventName: userId ? AnalyticsEventName.SUCCESSFUL_PREDICTION : AnalyticsEventName.SUCCESSFUL_TRIAL, 
      req 
    });

    const newPrediction = await PredictionHistoryModel.create({
      user: userId, media: newMedia._id, mediaPath: publicUrl,
      predictions: payload.detections, processedMediaPath: publicUrl,
      modelUsed: `YOLOv8_stream`, source: 'stream_capture',
    });

    return newPrediction.populate<{ media: MediaDoc, user: UserDoc }>([{ path: "user", select: "-password" }, { path: "media" }]);
  },
};