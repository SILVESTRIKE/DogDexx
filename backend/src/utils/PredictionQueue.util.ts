import { Queue, Worker } from 'bullmq';
import { logger } from "./logger.util";
import IORedis from 'ioredis';

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

export interface PredictionJobData {
    predictionId: string;
    mediaId: string;
    userId: string | undefined;
    directoryId: string | undefined;
    filePath: string;
    fileOriginalName: string;
    fileType: "image" | "video";
    modelName: string;
    startTime: number;
    analyticsData: any;
    lang?: 'vi' | 'en';
}

export const predictionQueue = new Queue<PredictionJobData>('prediction-queue', {
    connection: new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', redisConfig)
});

const worker = new Worker<PredictionJobData>('prediction-queue', async (job) => {
    logger.info(`[PredictionWorker] Processing job ${job.id}`);
    const { predictionService } = await import("../services/prediction.service");
    await predictionService.processAsyncPrediction(job.data);
}, {
    connection: new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', redisConfig),
    concurrency: 1 // GIỚI HẠN SỐ LƯỢNG XỬ LÝ ĐỂ KHÔNG SẬP SERVER
});