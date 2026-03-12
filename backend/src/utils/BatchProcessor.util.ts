import { EventEmitter } from 'events';
import { Types } from 'mongoose';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { logger } from './logger.util';
import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import { predictionNotifier } from './predictionNotifier.util';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

const getRedisConfig = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const isTls = redisUrl.startsWith('rediss://');
  return {
    maxRetriesPerRequest: null,
    family: 4, // Force IPv4
    keepAlive: 10000,
    ...(isTls && {
      tls: {
        rejectUnauthorized: false
      }
    })
  };
};
const redisConfig = getRedisConfig();

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
  private progressMap: Map<string, PredictionProgress> = new Map();

  // BullMQ Components
  private videoQueue: Queue;
  private videoWorker: Worker;
  private queueEvents: QueueEvents;

  constructor(maxBatchSize = 8, maxWaitTime = 50) {
    super();
    this.maxBatchSize = maxBatchSize;
    this.maxWaitTime = maxWaitTime;

    // Initialize BullMQ
    const options = { connection: new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', redisConfig) };
    this.videoQueue = new Queue('video-batch-queue', options);
    this.queueEvents = new QueueEvents('video-batch-queue', options);

    this.videoWorker = new Worker('video-batch-queue', async (job: Job) => {
      return this.processVideoJob(job);
    }, {
      ...options,
      concurrency: 2
    });

    this.videoWorker.on('progress', (job, progress) => {
      if (job) {
        this.updateProgress(job.id as string, 'processing', progress as number, 'Đang xử lý video...');
        predictionNotifier.notify(job.id as string, 'progress', { progress });
      }
    });

    this.videoWorker.on('completed', (job, result) => {
      if (job) {
        this.updateProgress(job.id as string, 'completed', 100, 'Xử lý video hoàn tất', result);
        // Push notification to WebSocket clients
        predictionNotifier.notify(job.id as string, 'completed', { result });
      }
    });

    this.videoWorker.on('failed', (job, err) => {
      if (job) {
        this.updateProgress(job.id as string, 'failed', 0, err.message);
        predictionNotifier.notify(job.id as string, 'failed', { message: err.message });
      }
    });
  }

  private updateProgress(id: string, status: PredictionProgress['status'], progress: number = 0, message: string = '', result?: any) {
    this.progressMap.set(id, { status, progress, message, result });
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

    if (this.batches[batchKey].length === 1 && !this.timers[batchKey]) {
      this.processBatch(batchKey);
    }
    else if (this.batches[batchKey].length >= this.maxBatchSize) {
      this.processBatch(batchKey);
    }
    else if (!this.timers[batchKey]) {
      this.timers[batchKey] = setTimeout(() => this.processBatch(batchKey), this.maxWaitTime);
    }

    return new Promise((resolve, reject) => {
      item.resolve = resolve;
      item.reject = reject;
    });
  }

  private async handleVideoRequest(item: BatchItem): Promise<any> {
    // Prepare data for Job
    let filePath = '';
    let cleanupNeeded = false;

    if (item.file) {
      filePath = item.file.path;
    } else if (item.buffer) {
      // Write buffer to temp file
      const tempDir = os.tmpdir();
      const fileName = item.originalName || `video-${item.id}.mp4`;
      filePath = path.join(tempDir, fileName);
      await fs.promises.writeFile(filePath, item.buffer);
      cleanupNeeded = true;
    } else {
      throw new Error("No file or buffer provided");
    }

    this.updateProgress(item.id, 'queued', 0, 'Đang đợi xử lý video...');

    try {
      const job = await this.videoQueue.add('process-video', {
        id: item.id,
        filePath,
        originalName: item.originalName,
        cleanupNeeded
      }, {
        jobId: item.id, // Use item.id as jobId for easy tracking
        removeOnComplete: true, // Keep Redis clean
        removeOnFail: 100
      });

      // Listen for progress to call item.onProgress
      // Note: Global events listeners might be cleaner but this works

      // Wait for finish
      const result = await job.waitUntilFinished(this.queueEvents);
      return result;

    } catch (error: any) {
      throw error;
    }
  }

  // Logic moved to Worker
  private async processVideoJob(job: Job): Promise<any> {
    const { id, filePath, originalName, cleanupNeeded } = job.data;

    // Simulate progress
    await job.updateProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", fs.createReadStream(filePath), {
        filename: originalName || 'video.mp4'
      });

      await job.updateProgress(20);

      const response = await this.makeRequestWithRetry(async () => {
        const startTime = Date.now();
        logger.info(`[Timing] [BatchProcessor] [${id}] Sending video request to AI Service.`);
        const res = await axios.post(
          `${AI_SERVICE_URL}/predict/video`,
          formData,
          {
            headers: { ...formData.getHeaders() },
            timeout: 600000,
          }
        );
        logger.info(`[Timing] [BatchProcessor] [${id}] Received video response. Duration: ${Date.now() - startTime}ms`);
        return res;
      });

      await job.updateProgress(100);

      // Cleanup temp file if needed
      if (cleanupNeeded) {
        fs.unlink(filePath, (err) => { if (err) logger.error(`Failed to delete temp video ${filePath}`, err) });
      }

      return response.data;

    } catch (error) {
      // Cleanup even on error
      if (cleanupNeeded) {
        fs.unlink(filePath, (err) => { if (err) logger.error(`Failed to delete temp video ${filePath}`, err) });
      }
      throw error;
    }
  }

  private async makeRequestWithRetry(
    fn: () => Promise<any>,
    retries: number = 3,
    delay: number = 2000
  ): Promise<any> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0) {
        logger.warn(`[BatchProcessor] Request failed, retrying... (${retries} attempts left). Error: ${error instanceof Error ? error.message : String(error)}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequestWithRetry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  // --- Image Batch Processing (Kept as is for high throughput) ---
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
        this.updateProgress(item.id, 'processing', 0, 'Đang xử lý...');
      });

      await this.makeRequestWithRetry(async () => {
        const startTime = Date.now();
        logger.info(`[Timing] [BatchProcessor] Sending request to ${AI_SERVICE_URL}/predict/images`);
        const response = await axios.post(
          `${AI_SERVICE_URL}/predict/images`,
          formData,
          {
            headers: { ...formData.getHeaders() },
            timeout: 3000000,
          }
        );
        logger.info(`[Timing] [BatchProcessor] Received response from AI Service. Status: ${response.status}. Duration: ${Date.now() - startTime}ms`);

        const results = response.data.results;
        currentBatch.forEach((item, index) => {
          const result = results[index];
          this.updateProgress(item.id, 'completed', 100, 'Xử lý hoàn tất', result);
          item.resolve(result);
        });
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Lỗi không xác định';
      currentBatch.forEach(item => {
        this.updateProgress(item.id, 'failed', 0, errorMessage);
        item.reject(new Error(errorMessage));
      });
    }
  }
}

export const batchProcessor = new BatchProcessor();