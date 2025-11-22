import { Request } from 'express';
import axios from "axios";
import FormData from "form-data";
import sharp from 'sharp';
import path from "path";
import { spawnSync } from 'child_process';
import { Readable } from 'stream'; // THÊM: Import Readable từ stream
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
// Configurable timeout (ms) for calls to the AI service. Defaults to 10 minutes.
const AI_SERVICE_TIMEOUT_MS = Number(process.env.AI_SERVICE_TIMEOUT_MS) || 600000;
const MAX_IMAGE_DIMENSION = 1280; // Giới hạn kích thước ảnh
const VIDEO_TARGET_BITRATE = '1000k'; // Giới hạn bitrate cho video

// Video preprocessing (before sending to AI service) - configurable via env
const VIDEO_PREPROCESS_ENABLED = process.env.VIDEO_PREPROCESS_ENABLED !== '0';
const VIDEO_PREPROCESS_MAX_WIDTH = Number(process.env.VIDEO_PREPROCESS_MAX_WIDTH) || 640; // px
const VIDEO_PREPROCESS_TARGET_FPS = Number(process.env.VIDEO_PREPROCESS_TARGET_FPS) || 15; // fps
const VIDEO_PREPROCESS_BITRATE = process.env.VIDEO_PREPROCESS_BITRATE || '500k';
const VIDEO_PREPROCESS_PRESET = process.env.VIDEO_PREPROCESS_PRESET || 'veryfast';

// Try to configure fluent-ffmpeg with a usable ffmpeg/ffprobe binary.
// Priority: explicit env vars -> @ffmpeg-installer/ffmpeg or ffmpeg-static -> system PATH
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
      } catch (e) {}
    }

    // Try system 'ffmpeg' on PATH
    try {
      const r2 = spawnSync('ffmpeg', ['-version']);
      if (r2.status === 0) return 'ffmpeg';
    } catch (e) {}

    // Try packaged installers
    try {
      // @ffmpeg-installer/ffmpeg exposes `.path`
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const installer = require('@ffmpeg-installer/ffmpeg');
      if (installer && installer.path) return installer.path;
    } catch (e) {}

    try {
      // ffmpeg-static returns a path string
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const staticF = require('ffmpeg-static');
      if (staticF) return staticF;
    } catch (e) {}

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

  // try to set ffprobe too (optional)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
    if (ffprobeInstaller && ffprobeInstaller.path) {
      ffmpegLib.setFfprobePath(ffprobeInstaller.path);
    }
  } catch (e) {
    try {
      // ffprobe-static may export path
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ffprobeStatic = require('ffprobe-static');
      if (ffprobeStatic && ffprobeStatic.path) ffmpegLib.setFfprobePath(ffprobeStatic.path);
    } catch (e) {}
  }
} catch (e) {
  // fluent-ffmpeg not installed/usable — we'll skip preprocessing gracefully
  FFMPEG_PROBE_MESSAGE = 'fluent-ffmpeg module not installed.';
}

if (!FFMPEG_AVAILABLE) {
  logger.warn(`[PredictionService] Video preprocessing disabled: ${FFMPEG_PROBE_MESSAGE}`);
} else {
  logger.info('[PredictionService] ffmpeg configured for video preprocessing.');
}

/**
 * THÊM: Tối ưu hóa buffer ảnh bằng Sharp
 * Resize ảnh nếu nó lớn hơn MAX_IMAGE_DIMENSION và nén lại.
 * @param buffer Buffer ảnh gốc
 * @returns Buffer ảnh đã được tối ưu hóa
 */
const optimizeImageBuffer = async (buffer: Buffer): Promise<Buffer> => {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if ((metadata.width && metadata.width > MAX_IMAGE_DIMENSION) || (metadata.height && metadata.height > MAX_IMAGE_DIMENSION)) {
        image.resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, { fit: 'inside', withoutEnlargement: true });
    }

    return image.jpeg({ quality: 85 }).toBuffer();
};

/**
 * THÊM: Tối ưu hóa buffer video bằng fluent-ffmpeg
 * @param buffer Buffer video gốc
 * @returns Buffer video đã được tối ưu hóa
 */
const optimizeVideoBuffer = (buffer: Buffer): Promise<Buffer> => {
  // If ffmpeg wasn't configured earlier, skip preprocessing to avoid runtime crashes.
  if (!FFMPEG_AVAILABLE) {
    logger.warn('[PredictionService] Skipping video preprocessing because ffmpeg is not available.');
    return Promise.resolve(buffer);
  }

  // fluent-ffmpeg should be available/configured at module init
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffmpeg = require('fluent-ffmpeg');

  // If preprocessing disabled, fallback to previous milder optimization
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

  // Preprocess: aggressively re-encode with lower resolution, lower fps and bitrate
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);

    try {
      // scale filter: limit width and keep aspect ratio (use -2 for even height)
      // SỬA LỖI: Đảm bảo video không bị phóng to và giữ đúng tỷ lệ khung hình.
      // 'force_original_aspect_ratio=decrease' đảm bảo video chỉ được thu nhỏ nếu nó lớn hơn kích thước mục tiêu.
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
      // fallback: resolve with original buffer
      resolve(buffer);
    }
  });
};

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
        // THAY ĐỔI: Tối ưu hóa media trước khi gửi.
        // In some dev environments ffmpeg/ flent-ffmpeg may not be available.
        // Allow skipping video optimization by setting SKIP_VIDEO_OPTIMIZATION=1 in env.
        let optimizedBuffer: Buffer;
        if (type === 'image') {
          optimizedBuffer = await optimizeImageBuffer(file.buffer);
        } else {
          const skipOpt = process.env.SKIP_VIDEO_OPTIMIZATION === '1' || process.env.SKIP_VIDEO_OPTIMIZATION === 'true';
          if (skipOpt) {
            logger.warn('[PredictionService] SKIP_VIDEO_OPTIMIZATION enabled — sending raw video buffer to AI service');
            optimizedBuffer = file.buffer;
          } else {
            optimizedBuffer = await optimizeVideoBuffer(file.buffer);
          }
        }
            const formData = new FormData();
            formData.append("file", optimizedBuffer, { filename: file.originalname });
            
            const endpoint = type === 'image' ? '/predict/image' : '/predict/video';
            logger.info(`[PredictionService] Calling AI service ${AI_SERVICE_URL}${endpoint} with timeout=${AI_SERVICE_TIMEOUT_MS}ms`);
            const response = await axios.post(`${AI_SERVICE_URL}${endpoint}`, formData, {
              headers: { ...formData.getHeaders() },
              timeout: AI_SERVICE_TIMEOUT_MS,
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

        logger.info("Bắt đầu xử lý AI và upload file gốc song song...");
        const [predictionResult, originalMediaPathForDb] = await Promise.all([
            sendToAIService(),
            uploadOriginalToCloudinary()
        ]);
        logger.info("Xử lý AI và upload file gốc đã hoàn tất.");

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
        
        logger.info("Đang upload file đã xử lý...");
        const processedFolder = `public/processed/${type}s`;
        const processedMediaPathForDb = await uploadBase64ToCloudinary(
            predictionResult.processed_media_base64,
            processedFolder,
            type
        );
        logger.info("Upload file đã xử lý hoàn tất.");
        
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