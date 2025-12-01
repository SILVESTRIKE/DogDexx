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
import { predictionQueue, PredictionJobData } from "../utils/PredictionQueue.util";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const MAX_IMAGE_DIMENSION = 1500;

const VIDEO_PREPROCESS_ENABLED = process.env.VIDEO_PREPROCESS_ENABLED !== '0';
const VIDEO_PREPROCESS_MAX_WIDTH = Number(process.env.VIDEO_PREPROCESS_MAX_WIDTH) || 640;
const VIDEO_PREPROCESS_TARGET_FPS = Number(process.env.VIDEO_PREPROCESS_TARGET_FPS) || 15;
const VIDEO_PREPROCESS_BITRATE = process.env.VIDEO_PREPROCESS_BITRATE || '500k';
const VIDEO_PREPROCESS_PRESET = process.env.VIDEO_PREPROCESS_PRESET || 'ultrafast';
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

const optimizeVideoFile = (filePath: string): Promise<Buffer> => {
  if (process.env.SKIP_VIDEO_OPTIMIZATION === '1') {
    logger.warn('[PredictionService] SKIP_VIDEO_OPTIMIZATION enabled — sending raw video buffer to AI service');
    return fs.promises.readFile(filePath);
  }

  if (!FFMPEG_AVAILABLE) {
    logger.warn('[PredictionService] Skipping video preprocessing because ffmpeg is not available.');
    return fs.promises.readFile(filePath);
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffmpeg = require('fluent-ffmpeg');

  if (!VIDEO_PREPROCESS_ENABLED) {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      // SỬA: Truyền filePath trực tiếp vào ffmpeg, KHÔNG dùng .input(stream)
      const command = ffmpeg(filePath)
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

    try {
      const scaleFilter = `scale=${VIDEO_PREPROCESS_MAX_WIDTH}:-2:force_original_aspect_ratio=decrease`;

      // SỬA: Truyền filePath trực tiếp vào ffmpeg
      const command = ffmpeg(filePath)
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
      // Fallback: đọc file gốc nếu lỗi
      fs.promises.readFile(filePath).then(resolve).catch(reject);
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
  processAsyncPrediction: async (data: PredictionJobData) => {
    const { predictionId, mediaId, userId, directoryId, filePath, fileOriginalName, fileType, modelName, startTime, analyticsData } = data;
    try {
      // 1. Optimize Video
      const fileBuffer = await fs.promises.readFile(filePath);
      let optimizedBuffer: Buffer;
      if (fileType === 'image') optimizedBuffer = await optimizeImageBuffer(fileBuffer);
      else optimizedBuffer = await optimizeVideoFile(filePath);

      // 2. Gọi AI
      const batchItem = {
        id: predictionId,
        userId: userId ? new Types.ObjectId(userId) : undefined,
        buffer: optimizedBuffer,
        originalName: fileOriginalName,
        mediaType: fileType,
        resolve: () => { }, reject: () => { }
      };
      const predictionResult = await batchProcessor.add(batchItem);

      // 3. [QUAN TRỌNG] Lưu file tạm vào đúng chỗ Controller có thể đọc
      // Đường dẫn này phải khớp với TEMP_UPLOAD_DIR trong Controller
      const TEMP_UPLOAD_DIR = path.join(__dirname, "../../public/uploads/temp");
      if (!fs.existsSync(TEMP_UPLOAD_DIR)) fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });

      const processedMediaPathTemp = path.join(TEMP_UPLOAD_DIR, `processed_${predictionId}.txt`);
      await fs.promises.writeFile(processedMediaPathTemp, predictionResult.processed_media_base64);

      // 4. [MỚI] Update DB NGAY LẬP TỨC để Frontend hiển thị được luôn
      await PredictionHistoryModel.findByIdAndUpdate(predictionId, {
        predictions: predictionResult.predictions,
        // Vẫn để path là 'processing' để Controller biết đường tìm file tạm
        processedMediaPath: "processing"
      });

      // 5. Đẩy sang UploadQueue (để upload Cloudinary sau)
      await uploadQueue.add('upload-job', {
        predictionId,
        mediaId: mediaId, // <--- SỬA CHỖ NÀY (trước là mediaId: "")
        predictionHistoryId: predictionId,
        userId,
        directoryId,
        filePath,
        fileOriginalName,
        fileType,
        predictionResult: { predictions: predictionResult.predictions },
        processedMediaPathTemp, // Truyền path file tạm sang cho UploadQueue dùng
        modelName,
        startTime,
        analyticsData
      }, { removeOnComplete: true });

    } catch (error) {
      logger.error(`[AsyncPrediction] Failed:`, error);

      await PredictionHistoryModel.findByIdAndUpdate(predictionId, {
        processedMediaPath: "failed"
      });

      if (fs.existsSync(filePath)) await fs.promises.unlink(filePath).catch(() => { });
    }
  },

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

      // [FIX] Update DB to failed
      await PredictionHistoryModel.findByIdAndUpdate(predictionHistoryId, {
        processedMediaPath: "failed"
      });
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
  ): Promise<{ predictionId: string, status: string }> => {
    if (!file) throw new BadRequestError("No file.");
    const predictionId = new Types.ObjectId();

    // ... (Giữ nguyên logic lấy directory_id, modelName) ...
    let directory_id: Types.ObjectId | undefined;
    if (userId) {
      const userDirectory = await DirectoryModel.findOne({ creator_id: userId, parent_id: null });
      if (userDirectory) directory_id = userDirectory._id;
    }
    const activeModel = await AIModelService.findActiveModelForTask("DOG_BREED_CLASSIFICATION");
    const modelName = activeModel ? activeModel.name : 'unknown_model';

    // 1. Tạo Placeholder DB Record
    const newMedia = new MediaModel({
      name: file.originalname,
      mediaPath: "processing",
      creator_id: userId,
      directory_id,
      type: type,
    });
    await newMedia.save();

    await PredictionHistoryModel.create({
      _id: predictionId,
      user: userId,
      media: newMedia._id,
      mediaPath: "processing",
      predictions: [],
      processedMediaPath: "processing",
      modelUsed: modelName,
      source: `${type}_upload`,
      processingTime: 0
    });

    // 2. Đẩy vào Queue
    await predictionQueue.add('prediction-job', {
      predictionId: predictionId.toString(),
      mediaId: newMedia._id.toString(),
      userId: userId?.toString(),
      directoryId: directory_id?.toString(),
      filePath: file.path,
      fileOriginalName: file.originalname,
      fileType: type,
      modelName,
      startTime: Date.now(),
      analyticsData: { ip: req.ip, userAgent: req.headers['user-agent'] }
    }, { removeOnComplete: true });

    // 3. Trả về ngay
    return { predictionId: predictionId.toString(), status: 'processing' };
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