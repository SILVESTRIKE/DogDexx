import { Request } from "express";
import { Types } from "mongoose";
import fs from "fs";
import path from "path";
import axios from "axios";
import sharp from "sharp";
import { spawnSync } from "child_process";
import { AIModelService } from "./ai_models.service";
import { DirectoryModel } from "../models/directory.model";
import { MediaModel, MediaDoc } from "../models/medias.model";
import { PredictionHistoryModel, PredictionHistoryDoc, IYoloPrediction, StreamResultPayload } from "../models/prediction_history.model";
import { UserDoc } from "../models/user.model";
import { BadRequestError } from "../errors";
import { logger } from "../utils/logger.util";
import { cloudinary } from "../config/cloudinary.config";
import { uploadFileToCloudinary } from "../utils/media.util";
import { batchProcessor } from "../utils/BatchProcessor.util";
import { uploadQueue, UploadJobData } from "../utils/UploadQueue.util";
import { analyticsService } from "./analytics.service";
import { AnalyticsEventName } from "../constants/analytics.constants";
import { predictionQueue, PredictionJobData } from "../utils/PredictionQueue.util";
import os from "os";
import { collectionService } from "./user_collections.service";
import { achievementService } from "./achievement.service";
import { userService } from "./user.service";
import { DirectoryService } from "./directory.service";

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
const uploadBase64ToCloudinary = async (base64Data: string, folder: string, resource_type: "image" | "video" = "image", access_mode?: "public" | "private"): Promise<string> => {
  const dataUri = `data:${resource_type === 'video' ? 'video/mp4' : 'image/jpeg'};base64,${base64Data}`;
  const type = access_mode === 'public' ? 'upload' : (access_mode === 'private' ? 'authenticated' : undefined);

  const uploadOptions: any = {
    folder: folder,
    resource_type: resource_type,
  };
  if (type) uploadOptions.type = type;

  const result = await cloudinary.uploader.upload(dataUri, uploadOptions);
  return `${result.public_id}.${result.format}`;
};

const optimizeImage = async (filePath: string): Promise<Buffer> => {
  // Truyền filePath vào sharp() thay vì buffer
  const image = sharp(filePath);
  const metadata = await image.metadata();

  // Resize xuống 1024px như bạn yêu cầu (hoặc 1500px tùy chọn)
  const MAX_DIMENSION = 1024;

  if ((metadata.width && metadata.width > MAX_DIMENSION) || (metadata.height && metadata.height > MAX_DIMENSION)) {
    image.resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true });
  }

  return image.jpeg({ quality: 85 }).toBuffer();
};

const optimizeVideoFile = async (filePath: string): Promise<Buffer> => {
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

  // Helper function to run ffmpeg with error handling
  const runFfmpeg = (command: any): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const outputStream = command.pipe();
      outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      command.on('end', () => resolve(Buffer.concat(chunks)));
      command.on('error', (err: Error) => reject(err));
    });
  };

  try {
    if (!VIDEO_PREPROCESS_ENABLED) {
      const command = ffmpeg(filePath)
        .videoBitrate(VIDEO_TARGET_BITRATE)
        .withVideoCodec('libx264')
        .addOption('-preset', 'fast')
        .addOption('-movflags', 'frag_keyframe+empty_moov')
        .outputFormat('mp4');

      return await runFfmpeg(command);
    }

    const command = ffmpeg(filePath)
      .withVideoCodec('libx264')
      .videoBitrate(VIDEO_PREPROCESS_BITRATE)
      .addOption('-preset', VIDEO_PREPROCESS_PRESET)
      .format('mp4');

    return await runFfmpeg(command);
  } catch (err: any) {
    // FALLBACK: If libx264 fails, send raw video to AI service
    logger.warn(`[PredictionService] FFmpeg encoding failed (${err.message}). Sending raw video to AI service.`);
    return fs.promises.readFile(filePath);
  }
};

export const predictionService = {
  processAsyncPrediction: async (data: PredictionJobData) => {
    const { predictionId, mediaId, userId, directoryId, filePath, fileOriginalName, fileType, modelName, startTime, analyticsData } = data;
    try {
      // 1. Optimize Video
      let optimizedBuffer: Buffer;
      if (fileType === 'image') {
        // Gọi hàm mới với filePath
        optimizedBuffer = await optimizeImage(filePath);
      } else {
        optimizedBuffer = await optimizeVideoFile(filePath);
      }
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

      // 3. Update DB NGAY LẬP TỨC để Frontend hiển thị được luôn
      await PredictionHistoryModel.findByIdAndUpdate(predictionId, {
        predictions: predictionResult.predictions,
        processedMediaPath: "processing"
      });

      // 4. Lưu file tạm vào đúng chỗ Controller có thể đọc
      const TEMP_UPLOAD_DIR = os.tmpdir();
      const processedMediaPathTemp = path.join(TEMP_UPLOAD_DIR, `processed_${predictionId}.txt`);
      logger.info(`[PredictionService] Writing temp file to: ${processedMediaPathTemp}`);
      await fs.promises.writeFile(processedMediaPathTemp, predictionResult.processed_media_base64);


      // Cập nhật User Collection & Achievements
      if (userId) {
        try {
          const lang = data.lang || 'en';
          const breedSlugs = predictionResult.predictions.map((p: IYoloPrediction) => p.class.toLowerCase().replace(/\s+/g, '-'));

          // Update Collection
          await collectionService.addOrUpdateManyCollections(
            new Types.ObjectId(userId),
            breedSlugs,
            new Types.ObjectId(predictionId),
            lang
          );

          // Process Achievements
          const [userAfterUpdate, newCollections] = await Promise.all([
            userService.getById(userId),
            collectionService.getUserCollection(new Types.ObjectId(userId))
          ]);

          if (userAfterUpdate) {
            await achievementService.processUserAchievements(
              userAfterUpdate as UserDoc,
              newCollections,
              lang
            );
          }
          logger.info(`[AsyncPrediction] Updated collection & achievements for User ${userId}`);
        } catch (err) {
          logger.error(`[AsyncPrediction] Failed to update collection/achievements:`, err);
        }
      }

      // 5. Đẩy sang UploadQueue (để upload Cloudinary sau)
      await uploadQueue.add('upload-job', {
        predictionId,
        mediaId: mediaId,
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
        uploadFileToCloudinary(filePath, filenameWithoutExt, `public/uploads/${fileType}s`, fileType, 'private')
          .then(res => `${res.public_id}.${res.format}`),
        uploadBase64ToCloudinary(
          processedMediaBase64,
          `public/processed/${fileType}s`,
          fileType,
          'private'
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

  makeEphemeralPrediction: async (
    file: Express.Multer.File,
    userId: Types.ObjectId | undefined // Optional, for context or logging if needed
  ): Promise<any> => {
    if (!file) throw new BadRequestError("No file.");

    try {
      // 1. Optimize Image (Resize)
      const optimizedBuffer = await optimizeImage(file.path);
      const tempId = new Types.ObjectId().toString();

      // 2. Call AI Service (via BatchProcessor for consistency & queueing)
      const result = await batchProcessor.add({
        id: tempId,
        userId: userId, // Can be undefined
        buffer: optimizedBuffer,
        mediaType: 'image',
        resolve: () => { },
        reject: () => { }
      });

      if (!result?.predictions) {
        throw new Error("Invalid result from AI");
      }

      // 3. Return result directly (Ephemeral)
      return {
        predictions: result.predictions,
        processed_media_base64: result.processed_media_base64
      };

    } catch (err) {
      logger.error(`[EphemeralPrediction] Failed for file ${file.originalname}`, err);
      throw err;
    } finally {
      if (file.path && fs.existsSync(file.path)) {
        await fs.promises.unlink(file.path).catch(err =>
          logger.warn(`[Cleanup] Failed to delete temp file ${file.path}`, err)
        );
      }
    }
  },

  makeBatchPredictions: async (
    userId: Types.ObjectId | undefined,
    files: Express.Multer.File[],
    req: Request
  ): Promise<PredictionHistoryDoc[]> => {

    if (!files.length) throw new BadRequestError("Không có file.");
    const startTime = Date.now();

    let directory_id: Types.ObjectId | undefined;
    if (userId) {
      const userDirectory = await DirectoryModel.findOne({ creator_id: userId, parent_id: null });
      if (!userDirectory) throw new BadRequestError("Không tìm thấy thư mục người dùng.");

      const myDogsDir = await DirectoryService.ensureDirectory("My Dogs", userDirectory._id.toString(), new Types.ObjectId(userId));
      directory_id = myDogsDir._id;
    }
    const activeModel = await AIModelService.findActiveModelForTask("DOG_BREED_CLASSIFICATION");
    const modelName = activeModel ? activeModel.name : 'unknown_model';

    const promises = files.map(async (file) => {
      try {
        const optimizedBuffer = await optimizeImage(file.path);
        const tempId = new Types.ObjectId().toString();
        const extension = path.extname(file.originalname);
        const filenameWithoutExt = path.parse(file.originalname).name;

        // 2. CHẠY SONG SONG: [Gửi AI] + [Upload Ảnh Gốc lên Cloudinary]
        const [result, uploadedOriginalPath] = await Promise.all([
          // Task A: Gửi sang AI (Batch)
          batchProcessor.add({
            id: tempId,
            userId: userId,
            buffer: optimizedBuffer,
            mediaType: 'image',
            resolve: () => { },
            reject: () => { }
          }),

          // Task B: Upload ảnh gốc (để lưu trữ lâu dài)
          uploadFileToCloudinary(file.path, `${filenameWithoutExt}_${Date.now()}`, 'public/uploads/images', 'image', 'private')
            .then(res => `${res.public_id}.${res.format}`)
            .catch(err => {
              logger.warn(`[BatchUpload] Failed to upload original image ${file.originalname}`, err);
              return `${file.filename}${extension}`; // Fallback: Giữ tên file local nếu upload lỗi
            })
        ]);

        // 3. Kiểm tra kết quả AI
        if (!result?.predictions || !result?.processed_media_base64) {
          throw new Error("Invalid batch result from AI");
        }

        // 4. Lưu Media Model
        const newMedia = new MediaModel({
          name: file.originalname,
          mediaPath: uploadedOriginalPath, // Dùng path trên Cloudinary (hoặc local fallback)
          creator_id: userId,
          directory_id,
          type: 'image',
        });
        await newMedia.save();

        // 5. Upload Ảnh đã xử lý (Bounding Box)
        const processedMediaPathForDb = await uploadBase64ToCloudinary(
          result.processed_media_base64,
          'public/processed/images',
          'image',
          'private'
        );

        // 6. Lưu Lịch sử Dự đoán
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

        return populatedPrediction as any as PredictionHistoryDoc;

      } catch (err) {
        logger.error(`[BatchError] Failed to process file ${file.originalname}`, err);
        return null; // Trả về null để không làm fail cả batch
      } finally {
        if (file.path && fs.existsSync(file.path)) {
          await fs.promises.unlink(file.path).catch(err =>
            logger.warn(`[Cleanup] Failed to delete temp file ${file.path}`, err)
          );
        }
      }
    });

    const results = await Promise.all(promises);

    const predictions = results.filter((p): p is PredictionHistoryDoc => p !== null);

    analyticsService.trackEvent({
      eventName: userId ? AnalyticsEventName.SUCCESSFUL_PREDICTION : AnalyticsEventName.SUCCESSFUL_TRIAL,
      req,
      eventData: { fileCount: files.length }
    });

    const totalDuration = Date.now() - startTime;
    logger.info(`[PERF] BACKEND | Type: batch | Count: ${files.length} | Total: ${totalDuration}ms`);

    return predictions;
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
      analyticsData: { ip: req.ip, userAgent: req.headers['user-agent'] },
      lang: req.headers["accept-language"]?.split(",")[0].toLowerCase() === "vi" ? "vi" : "en"
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
    let finalUrl = url;

    // 1. Resolve Real URL (Handle Data URI / Google Redirects)
    try {
      if (url.startsWith('data:image')) {
        const base64Data = url.split(',')[1];
        // Upload private
        const relativePath = await uploadBase64ToCloudinary(base64Data, 'public/uploads/images', 'image', 'private');
        finalUrl = relativePath;
      } else {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('google.com')) {
          if (urlObj.pathname === '/images') {
            const imgUrl = urlObj.searchParams.get('imgurl');
            if (imgUrl) finalUrl = imgUrl;
          } else if (urlObj.pathname === '/url') {
            const targetUrl = urlObj.searchParams.get('url');
            if (targetUrl) finalUrl = targetUrl;
          }
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
      let buffer: Buffer | undefined;
      const CLOUD_NAME = process.env.CLOUD_NAME_CLOUDINARY || '';
      const isInternal = finalUrl.includes('res.cloudinary.com') && finalUrl.includes(CLOUD_NAME);

      if (isInternal) {
        try {
          const isPrivateFolder = finalUrl.includes('/uploads/images') || finalUrl.includes('/processed/') || finalUrl.includes('/uploads/videos');

          if (isPrivateFolder) {
            const parts = finalUrl.split('/upload/');
            if (parts.length === 2) {
              let suffix = parts[1];
              suffix = suffix.replace(/^v\d+\//, '');
              const publicId = suffix.includes('.') ? suffix.substring(0, suffix.lastIndexOf('.')) : suffix;

              const signedUrl = cloudinary.url(publicId, {
                type: 'authenticated',
                resource_type: 'image',
                sign_url: true,
                secure: true,
                auth_token: { key: cloudinary.config().api_secret }
              });

              const downloadRes = await axios.get(signedUrl, { responseType: 'arraybuffer' });
              buffer = Buffer.from(downloadRes.data);
            }
          }
        } catch (err: any) {
          logger.warn(`[PredictionService] Failed to download internal Cloudinary URL: ${err.message}. Falling back to normal URL.`);
        }
      }

      // 2. Call AI Service
      let predictionResult;

      if (buffer) {
        const tempId = new Types.ObjectId().toString();
        predictionResult = await batchProcessor.add({
          id: tempId,
          userId: userId,
          buffer: buffer,
          mediaType: 'image',
          resolve: () => { },
          reject: () => { }
        });
      } else {
        const aiResponse = await axios.post(`${AI_SERVICE_URL}/predict/url`, { url: finalUrl }, {
          headers: { "Content-Type": "application/json" }
        });
        predictionResult = aiResponse.data;
      }

      if (!predictionResult || !predictionResult.predictions) {
        throw new BadRequestError("URL không hợp lệ hoặc không phải là ảnh/video được hỗ trợ.");
      }

      // 3. Upload Processed Image
      const processedMediaPathForDb = await uploadBase64ToCloudinary(
        predictionResult.processed_media_base64,
        'public/processed/images',
        'image',
        'private'
      );

      // 4. Save to DB
      const newMedia = new MediaModel({
        name: `URL Prediction - ${new Date().toISOString()}`,
        mediaPath: finalUrl,
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
        eventData: { type: 'url', url: finalUrl },
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