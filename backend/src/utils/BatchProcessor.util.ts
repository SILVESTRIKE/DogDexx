import { EventEmitter } from 'events';
import { Types } from 'mongoose';
import FormData from 'form-data';
import fs from 'fs';
import axios from 'axios';
import { logger } from './logger.util';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export interface BatchItem {
  id: string;
  userId: Types.ObjectId | undefined;
  file?: Express.Multer.File;
  buffer?: Buffer;
  originalName?: string;
  mediaType: 'image' | 'video';
  onProgress?: (progress: number) => void;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

interface BatchGroup {
  [key: string]: BatchItem[];
}

export interface PredictionProgress {
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'not_found';
  progress?: number;
  message?: string;
  result?: any;
}

export class BatchProcessor extends EventEmitter {
  private batches: BatchGroup = {};
  private readonly maxBatchSize: number;
  private readonly maxWaitTime: number;
  private timers: { [key: string]: NodeJS.Timeout } = {};
  private readonly maxVideoProcessing: number = 2;
  private processingVideos: number = 0;
  private videoQueue: BatchItem[] = [];
  private progressMap: Map<string, PredictionProgress> = new Map();

  constructor(maxBatchSize = 8, maxWaitTime = 50) { // giảm thời gian chờ xuống 50ms
    super();
    this.maxBatchSize = maxBatchSize;
    this.maxWaitTime = maxWaitTime;
  }

  getProgress(predictionId: string): PredictionProgress {
    return this.progressMap.get(predictionId) || {
      status: 'not_found',
      message: 'Không tìm thấy thông tin dự đoán'
    };
  }

  async add(item: BatchItem): Promise<any> {
    if (item.mediaType === 'video') {
      return this.handleVideoRequest(item);
    }

    const batchKey = 'image';
    if (!this.batches[batchKey]) {
      this.batches[batchKey] = [];
    }

    this.batches[batchKey].push(item);
    this.progressMap.set(item.id, {
      status: 'queued',
      message: 'Đang đợi xử lý...'
    });

    // Nếu chỉ có 1 item trong batch và không có timer -> xử lý ngay
    if (this.batches[batchKey].length === 1 && !this.timers[batchKey]) {
      this.processBatch(batchKey);
    }
    // Nếu đã đủ batch size -> xử lý ngay
    else if (this.batches[batchKey].length >= this.maxBatchSize) {
      this.processBatch(batchKey);
    }
    // Nếu có nhiều item đang chờ và chưa có timer -> đặt timer
    else if (!this.timers[batchKey]) {
      this.timers[batchKey] = setTimeout(() => this.processBatch(batchKey), this.maxWaitTime);
    }

    return new Promise((resolve, reject) => {
      item.resolve = resolve;
      item.reject = reject;
    });
  }

  private async handleVideoRequest(item: BatchItem): Promise<any> {
    return new Promise((resolve, reject) => {
      const videoItem = {
        ...item,
        resolve,
        reject
      };

      this.progressMap.set(item.id, {
        status: 'queued',
        message: 'Đang đợi xử lý video...'
      });

      // Xử lý video ngay nếu không có video nào đang xử lý
      if (this.processingVideos === 0) {
        this.processVideo(videoItem);
      }
      // Nếu có ít hơn maxVideoProcessing videos đang xử lý -> xử lý luôn
      else if (this.processingVideos < this.maxVideoProcessing) {
        this.processVideo(videoItem);
      }
      // Nếu đã đạt giới hạn -> đưa vào queue
      else {
        this.videoQueue.push(videoItem);
      }
    });
  }

  private async processVideo(item: BatchItem) {
    this.processingVideos++;
    this.progressMap.set(item.id, {
      status: 'processing',
      progress: 0,
      message: 'Đang xử lý video...'
    });

    try {
      const formData = new FormData();
      if (item.buffer) {
        formData.append("file", item.buffer, {
          filename: item.originalName || 'video.mp4'
        });
      } else if (item.file) {
        formData.append("file", fs.createReadStream(item.file.path), {
          filename: item.file.originalname
        });
      } else {
        throw new Error("No file or buffer provided");
      }

      const startTime = Date.now();
      logger.info(`[Timing] [BatchProcessor] [${item.id}] Sending video request to AI Service.`);
      const response = await axios.post(
        `${AI_SERVICE_URL}/predict/video`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          timeout: 600000, // 10 minutes timeout for video
        }
      );
      logger.info(`[Timing] [BatchProcessor] [${item.id}] Received video response from AI Service. Duration: ${Date.now() - startTime}ms`);

      this.progressMap.set(item.id, {
        status: 'completed',
        progress: 100,
        message: 'Xử lý video hoàn tất',
        result: response.data
      });

      item.resolve(response.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
      this.progressMap.set(item.id, {
        status: 'failed',
        message: errorMessage
      });
      item.reject(new Error(errorMessage));
    } finally {
      this.processingVideos--;
      if (this.videoQueue.length > 0 && this.processingVideos < this.maxVideoProcessing) {
        const nextVideo = this.videoQueue.shift();
        if (nextVideo) {
          this.processVideo(nextVideo);
        }
      }
    }
  }

  private async processBatch(batchKey: string) {
    if (this.timers[batchKey]) {
      clearTimeout(this.timers[batchKey]);
      delete this.timers[batchKey];
    }

    if (!this.batches[batchKey] || this.batches[batchKey].length === 0) return;

    const currentBatch = this.batches[batchKey];
    this.batches[batchKey] = [];

    try {
      const formData = new FormData();
      currentBatch.forEach(item => {
        if (item.buffer) {
          formData.append("files", item.buffer, {
            filename: item.originalName || 'image.jpg'
          });
        } else if (item.file) {
          formData.append("files", fs.createReadStream(item.file.path), {
            filename: item.file.originalname
          });
        }
      });

      currentBatch.forEach(item => {
        this.progressMap.set(item.id, {
          status: 'processing',
          progress: 0,
          message: 'Đang xử lý...'
        });
      });

      const startTime = Date.now();
      logger.info(`[Timing] [BatchProcessor] Sending request to ${AI_SERVICE_URL}/predict/images`);
      const response = await axios.post(
        `${AI_SERVICE_URL}/predict/images`,
        formData,
        {
          headers: { ...formData.getHeaders() },
          timeout: 300000,
        }
      );
      logger.info(`[Timing] [BatchProcessor] Received response from AI Service. Status: ${response.status}. Duration: ${Date.now() - startTime}ms`);

      const results = response.data.results;
      currentBatch.forEach((item, index) => {
        const result = results[index];
        this.progressMap.set(item.id, {
          status: 'completed',
          progress: 100,
          message: 'Xử lý hoàn tất',
          result
        });
        item.resolve(result);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
      currentBatch.forEach(item => {
        this.progressMap.set(item.id, {
          status: 'failed',
          message: errorMessage
        });
        item.reject(new Error(errorMessage));
      });
    }
  }
}

// Tạo và export một instance duy nhất (singleton) để toàn bộ app sử dụng
export const batchProcessor = new BatchProcessor();