import { Queue, Worker, Job } from 'bullmq';
import { logger } from "./logger.util";
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

export interface UploadJobData {
    predictionId: string;
    mediaId: string;
    predictionHistoryId: string;
    userId: string | undefined;
    directoryId: string | undefined;
    filePath: string;
    fileOriginalName: string;
    fileType: "image" | "video";
    predictionResult: {
        predictions: any[];
        // processed_media_base64: string; // REMOVED: Too large for Redis
    };
    processedMediaPathTemp?: string; // ADDED: Path to temp file containing Base64
    modelName: string;
    startTime: number;
    analyticsData: any;
}

// 1. Tạo Queue để Producer (PredictionService) đẩy job vào
export const uploadQueue = new Queue<UploadJobData>('upload-queue', { connection });

// 2. Tạo Worker để xử lý job (Consumer)
const worker = new Worker<UploadJobData>('upload-queue', async (job: Job<UploadJobData>) => {
    logger.info(`[UploadWorker] Processing job ${job.id} for prediction ${job.data.predictionId}`);
    try {
        // DYNAMIC IMPORT: Quan trọng để tránh lỗi Circular Dependency
        const { predictionService } = await import("../services/prediction.service");

        // Gọi hàm xử lý logic upload bên service
        await predictionService.processBackgroundUpload(job.data);

        logger.info(`[UploadWorker] Job ${job.id} completed`);
    } catch (error) {
        logger.error(`[UploadWorker] Job ${job.id} failed`, error);
        throw error;
    }
}, {
    connection,
    concurrency: 5 // Xử lý 5 upload cùng lúc
});

worker.on('completed', job => {
    logger.info(`[UploadWorker] Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
    logger.error(`[UploadWorker] Job ${job?.id} has failed with ${err.message}`);
});