import { Request } from "express";
import { Types } from "mongoose";
import fs from "fs";
import path from "path";
import axios from "axios";
import sharp from "sharp";
import { spawnSync } from "child_process";
import { Readable } from "stream";
import { UploadApiResponse } from "cloudinary";

import { AIModelService } from "./ai_models.service";
import { DirectoryModel } from "../models/directory.model";
import { MediaModel, MediaDoc } from "../models/medias.model";
import { PredictionHistoryModel, PredictionHistoryDoc, IYoloPrediction } from "../models/prediction_history.model";
import { UserDoc } from "../models/user.model";
import { BadRequestError } from "../errors";
import { logger } from "../utils/logger.util";
import { cloudinary } from "../config/cloudinary.config";
import { batchProcessor } from "../utils/BatchProcessor.util";
import { uploadQueue, UploadJobData } from "../utils/UploadQueue.util";
import { analyticsService } from "./analytics.service";
import { AnalyticsEventName } from "../constants/analytics.constants";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const MAX_IMAGE_DIMENSION = 1500;

const VIDEO_PREPROCESS_ENABLED = process.env.VIDEO_PREPROCESS_ENABLED !== '0';
const VIDEO_PREPROCESS_MAX_WIDTH = Number(process.env.VIDEO_PREPROCESS_MAX_WIDTH) || 640;
const VIDEO_PREPROCESS_TARGET_FPS = Number(process.env.VIDEO_PREPROCESS_TARGET_FPS) || 15;
const VIDEO_PREPROCESS_BITRATE = process.env.VIDEO_PREPROCESS_BITRATE || '500k';
const VIDEO_PREPROCESS_PRESET = process.env.VIDEO_PREPROCESS_PRESET || 'veryfast';
const VIDEO_TARGET_BITRATE = process.env.VIDEO_TARGET_BITRATE || '2000k';

const PREDICTION_SOURCES = {
  IMAGE_UPLOAD: 'image_upload',
  VIDEO_UPLOAD: 'video_upload',
  STREAM_CAPTURE: 'stream_capture',
  URL_INPUT: 'url_input'
} as const;

// Configure FFmpeg
let FFMPEG_AVAILABLE = false;
let FFMPEG_PROBE_MESSAGE = '';
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffmpegLib = require('fluent-ffmpeg');

  const probeFfmpeg = (): string | null => {
    const envPath = process.env.FFMPEG_PATH || process.env.FFMPEG;
    if (envPath) {
      try {
        const r = spawnSync(envPath, ['-version']);
        if (r.status === 0) return envPath;
      } catch (e) { }
    }

    try {
      const r2 = spawnSync('ffmpeg', ['-version']);
      if (r2.status === 0) return 'ffmpeg';
    } catch (e) { }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const installer = require('@ffmpeg-installer/ffmpeg');
      if (installer && installer.path) return installer.path;
    } catch (e) { }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const staticF = require('ffmpeg-static');
      if (staticF) return staticF;
    } catch (e) { }

    return null;
  };

  const ffmpegPath = probeFfmpeg();
  if (ffmpegPath) {
    try {
      ffmpegLib.setFfmpegPath(ffmpegPath);
      FFMPEG_AVAILABLE = true;
    } catch (e) {
      FFMPEG_PROBE_MESSAGE = String(e || 'failed to set ffmpeg path');
    }
  } else {
    FFMPEG_PROBE_MESSAGE = 'ffmpeg binary not found (set FFMPEG_PATH or install ffmpeg or add @ffmpeg-installer/ffmpeg or ffmpeg-static).';
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
    if (ffprobeInstaller && ffprobeInstaller.path) {
      ffmpegLib.setFfprobePath(ffprobeInstaller.path);
    }
  } catch (e) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ffprobeStatic = require('ffprobe-static');
      if (ffprobeStatic && ffprobeStatic.path) ffmpegLib.setFfprobePath(ffprobeStatic.path);
    } catch (e) { }
  }
} catch (e) {
  FFMPEG_PROBE_MESSAGE = 'fluent-ffmpeg module not installed.';
}

if (!FFMPEG_AVAILABLE) {
  logger.warn(`[PredictionService] Video preprocessing disabled: ${FFMPEG_PROBE_MESSAGE}`);
} else {
  logger.info('[PredictionService] ffmpeg configured for video preprocessing.');
}

// Optimize image: Resize & Compress
const optimizeImageBuffer = async (buffer: Buffer): Promise<Buffer> => {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if ((metadata.width && metadata.width > MAX_IMAGE_DIMENSION) || (metadata.height && metadata.height > MAX_IMAGE_DIMENSION)) {
    image.resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: 'inside', withoutEnlargement: true });
  }

  return image.jpeg({ quality: 85 }).toBuffer();
};

const optimizeVideoBuffer = (buffer: Buffer): Promise<Buffer> => {
  if (process.env.SKIP_VIDEO_OPTIMIZATION === '1') {
    logger.warn('[PredictionService] SKIP_VIDEO_OPTIMIZATION enabled — sending raw video buffer to AI service');
    return Promise.resolve(buffer);
  }

  if (!FFMPEG_AVAILABLE) {
    logger.warn('[PredictionService] Skipping video preprocessing because ffmpeg is not available.');
    return Promise.resolve(buffer);
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffmpeg = require('fluent-ffmpeg');

  if (!VIDEO_PREPROCESS_ENABLED) {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);

      const command = ffmpeg()
        .input(readableStream)
        .videoBitrate(VIDEO_TARGET_BITRATE)
        .withVideoCodec('libx264')
        .addOption('-preset', 'fast')
        .addOption('-movflags', 'frag_keyframe+empty_moov')
        .outputFormat('mp4')
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', (err: Error) => {
          logger.error('[FFMPEG Error] Lỗi trong quá trình xử lý video (fallback).', err);
          reject(new Error(`Lỗi khi tối ưu hóa video: ${err.message}`));
        });

      const outputStream = command.pipe();
      outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    });
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);

    try {
      const scaleFilter = `scale=${VIDEO_PREPROCESS_MAX_WIDTH}:-2:force_original_aspect_ratio=decrease`;

      const command = ffmpeg()
        .input(readableStream)
        .withVideoCodec('libx264')
        .videoBitrate(VIDEO_PREPROCESS_BITRATE)
        .addOption('-preset', VIDEO_PREPROCESS_PRESET)
        .addOption('-movflags', 'frag_keyframe+empty_moov')
        .addOption('-vf', scaleFilter)
        .addOption('-r', String(VIDEO_PREPROCESS_TARGET_FPS))
        .addOption('-profile:v', 'baseline')
        .outputFormat('mp4')
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', (err: Error) => {
          logger.error('[FFMPEG Error] Lỗi trong quá trình tiền xử lý video.', err);
          reject(new Error(`Lỗi khi tiền xử lý video: ${err.message}`));
        });

      const outputStream = command.pipe();
      outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    } catch (err: any) {
      logger.error('[PredictionService] Exception while trying to preprocess video buffer:', err);
      resolve(buffer);
    }
  });
};

interface StreamResultPayload {
  processed_media_base64: string;
  media_type: string;
  detections: IYoloPrediction[];
}

// Upload Base64 to Cloudinary
const uploadBase64ToCloudinary = async (base64Data: string, folder: string, resource_type: "image" | "video" = "image"): Promise<string> => {
  const dataUri = `data:${resource_type === 'video' ? 'video/mp4' : 'image/jpeg'};base64,${base64Data}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: folder,
    resource_type: resource_type,
  });
  return `${result.public_id}.${result.format}`;
};

// Upload Buffer to Cloudinary
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

export const predictionService = {
  processBackgroundUpload: async (data: UploadJobData) => {
    const { predictionId, mediaId, predictionHistoryId, userId, directoryId, filePath, fileOriginalName, fileType, predictionResult, modelName, startTime, analyticsData, processedMediaPathTemp } = data;
    const bgStartTime = Date.now();
    logger.info(`[Timing] [PredictionService] [${predictionId}] Starting background upload & save.`);

    try {
      logger.info(`[PredictionService] Starting background upload & save for ID: ${predictionId}`);

      // Read file from disk again (since we cannot pass buffer to Redis)
      const fileBuffer = await fs.promises.readFile(filePath);
      const filenameWithoutExt = `${path.parse(fileOriginalName).name}_${startTime}`;

      // Read processed media Base64 from temp file if available
      let processedMediaBase64: string | undefined; // Khai báo kiểu rõ ràng
      if (processedMediaPathTemp) {
        try {
          processedMediaBase64 = await fs.promises.readFile(processedMediaPathTemp, 'utf-8');
        } catch (err) {
          logger.error(`[PredictionService] Failed to read temp processed media file: ${processedMediaPathTemp}`, err);
        }
      }

      // Kiểm tra nếu không có dữ liệu
      if (!processedMediaBase64) {
        throw new Error("Missing processed media data (Base64) for upload.");
      }

      const [originalPath, processedPath] = await Promise.all([
        uploadBufferToCloudinary(fileBuffer, filenameWithoutExt, `public/uploads/${fileType}s`, fileType)
          .then(res => `${res.public_id}.${res.format}`),
        uploadBase64ToCloudinary(
          processedMediaBase64,
          `public/processed/${fileType}s`,
          fileType
        )
      ]);

      logger.info(`[Timing] [PredictionService] [${predictionId}] Upload complete. Updating DB.`);

      // Update existing Media record
      await MediaModel.findByIdAndUpdate(mediaId, {
        mediaPath: originalPath,
        type: fileType
      });

      const processingTime = Date.now() - startTime;

      // Update existing PredictionHistory record
      await PredictionHistoryModel.findByIdAndUpdate(predictionHistoryId, {
        mediaPath: originalPath, // Update with real path
        processedMediaPath: processedPath, // Update with real path
        processingTime
      });

      // Reconstruct req mock for analytics
      const reqMock = {
        ip: analyticsData.ip,
        headers: { 'user-agent': analyticsData.userAgent }
      } as Request;

      analyticsService.trackEvent({
        eventName: userId ? AnalyticsEventName.SUCCESSFUL_PREDICTION : AnalyticsEventName.SUCCESSFUL_TRIAL,
        req: reqMock,
        eventData: { mediaType: fileType, filename: fileOriginalName },
        processingTime
      });

      logger.info(`[PredictionService] Background task completed for ID: ${predictionId}`);
      logger.info(`[Timing] [PredictionService] [${predictionId}] Background task completed. Duration: ${Date.now() - bgStartTime}ms`);
    } catch (bgError) {
      logger.error(`[PredictionService] Background task failed for ID: ${predictionId}`, bgError);
      logger.error(`[Timing] [PredictionService] [${predictionId}] Background task failed:`, bgError);
    } finally {
      // CLEANUP: Delete temp file
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          logger.info(`[PredictionService] Deleted temp file: ${filePath}`);
        }
        // Cleanup temp processed media file
        if (processedMediaPathTemp && fs.existsSync(processedMediaPathTemp)) {
          await fs.promises.unlink(processedMediaPathTemp);
          logger.info(`[PredictionService] Deleted temp processed file: ${processedMediaPathTemp}`);
        }
      } catch (cleanupError) {
        logger.error(`[PredictionService] Failed to delete temp file: ${filePath}`, cleanupError);
      }
    }
  },

  getPredictionStatus: async (predictionId: string) => {
    return batchProcessor.getProgress(predictionId);
  },

  makeBatchPredictions: async (
    userId: Types.ObjectId | undefined,
    files: Express.Multer.File[],
    req: Request
  ): Promise<PredictionHistoryDoc[]> => {
    if (!files.length) throw new BadRequestError("Không có file nào được cung cấp.");
    const startTime = Date.now(); // [PERF] Start timer

    try {
      let directory_id: Types.ObjectId | undefined;
      if (userId) {
        const userDirectory = await DirectoryModel.findOne({ creator_id: userId, parent_id: null });
        if (!userDirectory) throw new BadRequestError("Không tìm thấy thư mục người dùng.");
        directory_id = userDirectory._id;
      }

      const activeModel = await AIModelService.findActiveModelForTask("DOG_BREED_CLASSIFICATION");
      const modelName = activeModel ? activeModel.name : 'unknown_model';

      // [PERF] Measure AI Service Call
      const aiStartTime = Date.now();
      const response = await axios.post(`${AI_SERVICE_URL}/predict/images_by_urls`, {
        urls: files.map(file => file.path)
      });
      const aiDuration = Date.now() - aiStartTime; // [PERF] AI Duration

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

      // [PERF] Log Total Duration
      const totalDuration = Date.now() - startTime;
      logger.info(`[PERF] BACKEND | Type: batch | Count: ${files.length} | AI: ${aiDuration}ms | Total: ${totalDuration}ms`);

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
  },

  makePrediction: async (
    userId: Types.ObjectId | undefined,
    file: Express.Multer.File,
    type: "image" | "video",
    req: Request
  ): Promise<{ predictions: IYoloPrediction[], processed_base64: string, predictionId: string }> => {
    if (!file) throw new BadRequestError("Không có file nào được cung cấp.");
    const startTime = Date.now();

    let directory_id: Types.ObjectId | undefined;
    if (userId) {
      const userDirectory = await DirectoryModel.findOne({ creator_id: userId, parent_id: null });
      if (!userDirectory) throw new BadRequestError("Không tìm thấy thư mục người dùng.");
      directory_id = userDirectory._id;
    }

    const activeModel = await AIModelService.findActiveModelForTask("DOG_BREED_CLASSIFICATION");
    const modelName = activeModel ? activeModel.name : 'unknown_model';

    try {
      // 1. Đọc file từ disk
      const fileBuffer = await fs.promises.readFile(file.path);

      // 2. Tối ưu file (Video/Image)
      const optStartTime = Date.now();
      let optimizedBuffer: Buffer;
      if (type === 'image') {
        optimizedBuffer = await optimizeImageBuffer(fileBuffer);
      } else {
        optimizedBuffer = await optimizeVideoBuffer(fileBuffer);
      }
      const optDuration = Date.now() - optStartTime;

      // 3. Gửi cho AI dự đoán
      const timestamp = Date.now();
      const predictionId = new Types.ObjectId();

      logger.info(`[Timing] [PredictionService] [${predictionId}] Starting prediction flow. Type: ${type}`);

      const batchItem = {
        id: predictionId.toString(),
        userId: userId,
        buffer: optimizedBuffer,
        originalName: file.originalname,
        mediaType: type,
        resolve: () => { },
        reject: () => { }
      };

      logger.info(`[PredictionService] Starting AI prediction (ID: ${batchItem.id})`);

      // Gọi AI Service
      const aiStartTime = Date.now();
      logger.info(`[Timing] [PredictionService] [${predictionId}] Submitting to BatchProcessor.`);
      const predictionResult = await batchProcessor.add(batchItem);
      const aiDuration = Date.now() - aiStartTime;
      logger.info(`[Timing] [PredictionService] [${predictionId}] AI processing complete. Duration: ${aiDuration}ms`);

      const totalServiceDuration = Date.now() - startTime;
      logger.info(`[PERF] BACKEND | Type: ${type} | Opt: ${optDuration}ms | AI: ${aiDuration}ms | Total: ${totalServiceDuration}ms`);

      if (!predictionResult?.predictions || !predictionResult?.processed_media_base64) {
        throw new Error("Kết quả từ AI service không hợp lệ.");
      }

      // 4. CREATE DB RECORDS SYNCHRONOUSLY (Placeholder status)
      const newMedia = new MediaModel({
        name: file.originalname,
        mediaPath: `processing_upload_${timestamp}`, // Placeholder
        creator_id: userId,
        directory_id,
        type: type,
      });
      await newMedia.save();

      const newPredictionHistory = await PredictionHistoryModel.create({
        _id: predictionId,
        user: userId,
        media: newMedia._id,
        mediaPath: newMedia.mediaPath, // Placeholder
        predictions: predictionResult.predictions,
        processedMediaPath: "processing", // Placeholder
        modelUsed: modelName,
        source: `${type}_upload` as any,
        processingTime: 0 // Will be updated later
      });

      // 5. BACKGROUND TASKS: Upload & Update DB (Use Queue)
      const analyticsData = {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      };

      // Write processed Base64 to temp file to avoid Redis OOM
      const processedMediaPathTemp = path.join(path.dirname(file.path), `processed_${predictionId}.txt`);
      await fs.promises.writeFile(processedMediaPathTemp, predictionResult.processed_media_base64);

      uploadQueue.add('upload-job', {
        predictionId: predictionId.toString(),
        mediaId: newMedia._id.toString(),
        predictionHistoryId: newPredictionHistory._id.toString(),
        userId: userId?.toString(),
        directoryId: directory_id?.toString(), // SỬA: dùng directory_id
        filePath: file.path,
        fileOriginalName: file.originalname,
        fileType: type,
        predictionResult: {
          predictions: predictionResult.predictions,
          // Đã xóa processed_media_base64 để tránh lỗi OOM Redis
        } as any,
        processedMediaPathTemp,
        modelName,
        startTime,
        analyticsData
      }, {
        removeOnComplete: true,
        removeOnFail: 50,
      });

      logger.info(`[PredictionService] Job added to Redis queue for ID: ${predictionId}`);

      // 6. Return result immediately
      return {
        predictions: predictionResult.predictions,
        processed_base64: predictionResult.processed_media_base64,
        predictionId: predictionId.toString()
      };

    } catch (error: any) {
      // Cleanup temp file on error
      try {
        if (fs.existsSync(file.path)) {
          await fs.promises.unlink(file.path);
        }
      } catch (e) { }

      if (axios.isAxiosError(error)) {
        logger.error(`[PredictionService] Lỗi Axios: ${error.message}`);
      } else {
        logger.error(`[PredictionService] Lỗi:`, error);
      }
      throw new Error("Không thể xử lý dự đoán do có lỗi từ dịch vụ AI.");
    }
  },

  saveStreamPrediction: async (
    userId: Types.ObjectId | undefined,
    payload: StreamResultPayload,
    req: Request
  ): Promise<PredictionHistoryDoc> => {
    if (!payload || !payload.processed_media_base64 || !payload.detections) {
      throw new BadRequestError("Dữ liệu kết quả stream không hợp lệ.");
    }
    const startTime = Date.now();

    const activeModel = await AIModelService.findActiveModelForTask("DOG_BREED_CLASSIFICATION");
    const modelName = activeModel ? activeModel.name : 'unknown_model';

    const processedMediaPathForDb = await uploadBase64ToCloudinary(
      payload.processed_media_base64,
      'public/processed/images',
      'image'
    );

    let directory_id: Types.ObjectId | undefined;
    if (userId) {
      const userDirectory = await DirectoryModel.findOne({ creator_id: userId, parent_id: null });
      if (userDirectory) directory_id = userDirectory._id;
    }

    const newMedia = await MediaModel.create({
      name: `Stream Capture - ${new Date().toISOString()}`,
      mediaPath: processedMediaPathForDb,
      creator_id: userId,
      directory_id,
      type: 'image',
    });

    const processingTime = Date.now() - startTime;
    analyticsService.trackEvent({
      eventName: userId ? AnalyticsEventName.SUCCESSFUL_PREDICTION : AnalyticsEventName.SUCCESSFUL_TRIAL,
      req,
      processingTime
    });

    const newPrediction = await PredictionHistoryModel.create({
      user: userId,
      media: newMedia._id,
      mediaPath: processedMediaPathForDb,
      predictions: payload.detections,
      processedMediaPath: processedMediaPathForDb,
      modelUsed: modelName,
      source: PREDICTION_SOURCES.STREAM_CAPTURE,
      processingTime
    });

    return newPrediction.populate<{ media: MediaDoc, user: UserDoc }>([{ path: "user", select: "-password" }, { path: "media" }]);
  },

  makeUrlPrediction: async (
    userId: Types.ObjectId | undefined,
    url: string,
    req: Request
  ): Promise<PredictionHistoryDoc> => {
    const startTime = Date.now();
    // 1. Resolve Real URL (Handle Data URI / Google Redirects)
    try {
      if (url.startsWith('data:image')) {
        const base64Data = url.split(',')[1];
        const relativePath = await uploadBase64ToCloudinary(base64Data, 'public/uploads/images', 'image');
        url = cloudinary.url(relativePath, { secure: true, resource_type: 'image' });
      }

      const urlObj = new URL(url);
      if (urlObj.hostname.includes('google.com')) {
        if (urlObj.pathname === '/imgres') {
          const imgUrl = urlObj.searchParams.get('imgurl');
          if (imgUrl) url = imgUrl;
        } else if (urlObj.pathname === '/url') {
          const targetUrl = urlObj.searchParams.get('url');
          if (targetUrl) url = targetUrl;
        }
      }
    } catch (e) { }

    let directory_id: Types.ObjectId | undefined;
    if (userId) {
      const userDirectory = await DirectoryModel.findOne({ creator_id: userId, parent_id: null });
      if (userDirectory) directory_id = userDirectory._id;
    }

    const activeModel = await AIModelService.findActiveModelForTask("DOG_BREED_CLASSIFICATION");
    const modelName = activeModel ? activeModel.name : 'unknown_model';

    try {
      // 2. Call AI Service
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/predict/url`, { url }, {
        headers: { "Content-Type": "application/json" }
      });
      const predictionResult = aiResponse.data;

      if (predictionResult.status === "error" || !predictionResult.predictions) {
        throw new BadRequestError("URL không hợp lệ hoặc không phải là ảnh/video được hỗ trợ.");
      }

      // 3. Upload Processed Image
      const processedMediaPathForDb = await uploadBase64ToCloudinary(
        predictionResult.processed_media_base64,
        'public/processed/images',
        'image'
      );

      // 4. Save to DB
      const newMedia = new MediaModel({
        name: `URL Prediction - ${new Date().toISOString()}`,
        mediaPath: url,
        creator_id: userId,
        directory_id,
        type: 'image',
        isExternalUrl: true
      });
      await newMedia.save();

      const processingTime = Date.now() - startTime;
      const newPrediction = await PredictionHistoryModel.create({
        user: userId,
        media: newMedia._id,
        mediaPath: processedMediaPathForDb,
        predictions: predictionResult.predictions,
        processedMediaPath: processedMediaPathForDb,
        modelUsed: modelName,
        source: PREDICTION_SOURCES.URL_INPUT,
        processingTime
      });

      analyticsService.trackEvent({
        eventName: userId ? AnalyticsEventName.SUCCESSFUL_PREDICTION : AnalyticsEventName.SUCCESSFUL_TRIAL,
        req,
        eventData: { type: 'url', url },
        processingTime
      });

      return newPrediction.populate<{ media: MediaDoc, user: UserDoc }>([{ path: "user", select: "-password" }, { path: "media" }]);

    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        logger.error(`[PredictionService] Lỗi Axios khi gọi AI Service (URL): ${error.message}`);
        if (error.response?.status === 400) {
          throw new BadRequestError("URL không hợp lệ hoặc không phải là ảnh.");
        }
      }
      logger.error(`[PredictionService] Lỗi khi dự đoán từ URL:`, error);
      throw error;
    }
  },
};