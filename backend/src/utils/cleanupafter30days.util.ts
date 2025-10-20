import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { MediaModel } from '../models/medias.model'; 
import { logger } from './logger.util';

const cleanupOrphanedFiles = async () => {
    logger.info('--- [CRON JOB] Starting orphaned files cleanup task ---');
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const mediasToDelete = await MediaModel.find({
            isDeleted: true,
            updated_date: { $lte: thirtyDaysAgo }
        });

        if (mediasToDelete.length === 0) {
            logger.info('[CRON JOB] No media records found for cleanup.');
            logger.info('--- [CRON JOB] Cleanup task finished ---');
            return;
        }

        logger.info(`[CRON JOB] Found ${mediasToDelete.length} media records for cleanup.`);

        for (const media of mediasToDelete) {
            try {
                const filePath = path.join(process.cwd(), media.mediaPath);
                await fs.unlink(filePath);
                await MediaModel.deleteOne({ _id: media._id });
                logger.info(`[CRON JOB] Successfully deleted file and record for media ID: ${media._id}`);
            } catch (err: any) {
                if (err.code === 'ENOENT') {
                    logger.warn(`[CRON JOB] File not found, deleted DB record only: ${media.mediaPath}`);
                    await MediaModel.deleteOne({ _id: media._id });
                } else {
                    logger.error(`[CRON JOB] Error while processing media ID ${media._id}:`, err);
                }
            }
        }

    } catch (error) {
        logger.error('[CRON JOB] Fatal error during cleanup:', error);
    } finally {
        logger.info('--- [CRON JOB] Cleanup task finished ---');
    }
};

const schedule = '0 2 * * *'; // 2 AM every day

const cleanupTask = cron.schedule(schedule, cleanupOrphanedFiles, {
    timezone: "Asia/Ho_Chi_Minh"
});

cleanupTask.stop();
logger.info('[JOB SCHEDULER] Cleanup task has been initialized in STOPPED state.');

export const startCleanupJob = () => {
    if (process.env.ENABLE_CLEANUP_JOB === 'true') {
        logger.info('[JOB SCHEDULER] Starting cleanup task according to schedule.');
        cleanupTask.start();
    } else {
        logger.info('[JOB SCHEDULER] Cleanup task is DISABLED (based on .env configuration).');
    }
};
