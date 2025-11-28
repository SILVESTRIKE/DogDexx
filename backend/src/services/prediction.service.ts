import { Request } from 'express';
import axios from "axios";
import FormData from "form-data";
import sharp from 'sharp';
import path from "path";
import { spawnSync } from 'child_process';
import { Readable } from 'stream';
import { Types } from 'mongoose';
import { UploadApiResponse } from 'cloudinary';
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
const AI_SERVICE_TIMEOUT_MS = Number(process.env.AI_SERVICE_TIMEOUT_MS) || 600000;
const MAX_IMAGE_DIMENSION = 1280;
const VIDEO_TARGET_BITRATE = '1000k';

const VIDEO_PREPROCESS_ENABLED = process.env.VIDEO_PREPROCESS_ENABLED !== '0';
const VIDEO_PREPROCESS_MAX_WIDTH = Number(process.env.VIDEO_PREPROCESS_MAX_WIDTH) || 640;
const VIDEO_PREPROCESS_TARGET_FPS = Number(process.env.VIDEO_PREPROCESS_TARGET_FPS) || 15;
const VIDEO_PREPROCESS_BITRATE = process.env.VIDEO_PREPROCESS_BITRATE || '500k';
const VIDEO_PREPROCESS_PRESET = process.env.VIDEO_PREPROCESS_PRESET || 'veryfast';

// Configure FFmpeg
let FFMPEG_AVAILABLE = false;
let FFMPEG_PROBE_MESSAGE = '';
try {
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

    try {
      // 1. Tối ưu file (Video/Image)
      let optimizedBuffer: Buffer;
      if (type === 'image') {
        optimizedBuffer = await optimizeImageBuffer(file.buffer);
      } else {
        optimizedBuffer = await optimizeVideoBuffer(file.buffer);
      }

      // 2. SONG SONG: Upload ảnh gốc VÀ gửi cho AI dự đoán
      const timestamp = Date.now();
      const filenameWithoutExt = `${path.parse(file.originalname).name}_${timestamp}`;

      const batchItem = {
        id: new Types.ObjectId().toString(),
        userId: userId,
        buffer: optimizedBuffer,
        originalName: file.originalname,
        mediaType: type,
        resolve: () => { },
        reject: () => { }
      };

      logger.info(`[PredictionService] Starting parallel upload & AI prediction (ID: ${batchItem.id})`);

      const [predictionResult, originalPath] = await Promise.all([
        // AI Service prediction
        batchProcessor.add(batchItem),
        // Upload ảnh gốc lên Cloudinary
        uploadBufferToCloudinary(file.buffer, filenameWithoutExt, `public/uploads/${type}s`, type)
          .then(res => `${res.public_id}.${res.format}`)
      ]);

      if (!predictionResult?.predictions || !predictionResult?.processed_media_base64) {
        throw new Error("Kết quả từ AI service không hợp lệ.");
      }

      // 3. Upload ảnh đã xử lý (sau khi AI xong)
      const processedPath = await uploadBase64ToCloudinary(
        predictionResult.processed_media_base64,
        `public/processed/${type}s`,
        type
      );

      // 4. Lưu Media
      const newMedia = new MediaModel({
        name: file.originalname,
        mediaPath: originalPath,
        creator_id: userId,
        directory_id,
        type,
      });
      await newMedia.save();

      // 5. Lưu Prediction History
      const newPrediction = await PredictionHistoryModel.create({
        user: userId,
        media: newMedia._id,
        mediaPath: newMedia.mediaPath,
        predictions: predictionResult.predictions,
        processedMediaPath: processedPath,
        modelUsed: modelName,
        source: `${type}_upload` as any,
      });

      // 6. Track Analytics
      analyticsService.trackEvent({
        eventName: userId ? AnalyticsEventName.SUCCESSFUL_PREDICTION : AnalyticsEventName.SUCCESSFUL_TRIAL,
        req,
        eventData: { mediaType: type, filename: file.originalname }
      });

      // 7. Populate và trả về
      return newPrediction.populate<{ media: MediaDoc, user: UserDoc }>([
        { path: "user", select: "-password" },
        { path: "media" }
      ]);

    } catch (error: any) {
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

    analyticsService.trackEvent({
      eventName: userId ? AnalyticsEventName.SUCCESSFUL_PREDICTION : AnalyticsEventName.SUCCESSFUL_TRIAL,
      req
    });

    const newPrediction = await PredictionHistoryModel.create({
      user: userId,
      media: newMedia._id,
      mediaPath: processedMediaPathForDb,
      predictions: payload.detections,
      processedMediaPath: processedMediaPathForDb,
      modelUsed: modelName,
      source: PREDICTION_SOURCES.STREAM_CAPTURE,
    });

    return newPrediction.populate<{ media: MediaDoc, user: UserDoc }>([{ path: "user", select: "-password" }, { path: "media" }]);
  },

  makeUrlPrediction: async (
    userId: Types.ObjectId | undefined,
    url: string,
    req: Request
  ): Promise<PredictionHistoryDoc> => {
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

      const newPrediction = await PredictionHistoryModel.create({
        user: userId,
        media: newMedia._id,
        mediaPath: processedMediaPathForDb,
        predictions: predictionResult.predictions,
        processedMediaPath: processedMediaPathForDb,
        modelUsed: modelName,
        source: PREDICTION_SOURCES.URL_INPUT,
      });

      analyticsService.trackEvent({
        eventName: userId ? AnalyticsEventName.SUCCESSFUL_PREDICTION : AnalyticsEventName.SUCCESSFUL_TRIAL,
        req,
        eventData: { type: 'url', url }
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