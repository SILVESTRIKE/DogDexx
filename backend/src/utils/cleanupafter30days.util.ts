import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { exec as _exec } from 'child_process';
import { promisify } from 'util';
import { MediaModel } from '../models/medias.model'; 
import { logger } from './logger.util';
const exec = promisify(_exec);

const cleanupOrphanedFiles = async () => {
    logger.info('--- [CRON JOB] Starting orphaned files cleanup task ---');
    try {
        // Optional: create full DB backup before cleanup if enabled
        if (process.env.ENABLE_CLEANUP_DB_BACKUP === 'true') {
            const backupDir = process.env.DB_BACKUP_DIR || path.join(process.cwd(), 'backups');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outDir = path.join(backupDir, `dump-${timestamp}`);
            try {
                await fs.mkdir(outDir, { recursive: true });
                const mongoUri = process.env.MONGO_URI || process.env.DATABASE_URL || '';
                if (!mongoUri) {
                    logger.warn('[CRON JOB] ENABLE_CLEANUP_DB_BACKUP is true but MONGO_URI/DATABASE_URL is not set. Skipping DB dump.');
                } else {
                    logger.info(`[CRON JOB] Creating DB backup to ${outDir} ...`);
                    const cmd = `mongodump --uri="${mongoUri}" --out="${outDir}"`;
                    try {
                        const { stdout, stderr } = await exec(cmd, { maxBuffer: 10 * 1024 * 1024 });
                        if (stdout) logger.info(`[CRON JOB] mongodump stdout: ${stdout}`);
                        if (stderr) logger.warn(`[CRON JOB] mongodump stderr: ${stderr}`);
                        logger.info('[CRON JOB] DB backup completed.');
                    } catch (dumpErr: any) {
                        logger.error('[CRON JOB] DB backup failed (mongodump). Skipping cleanup. Error:', dumpErr?.message || dumpErr);
                        return; // abort cleanup to avoid data loss
                    }
                }
            } catch (err) {
                logger.error('[CRON JOB] Failed to prepare backup directory:', err);
                return; // abort to avoid cleanup without backup
            }
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const mediasToDelete = await MediaModel.find({
            isDeleted: true,
            updatedAt: { $lte: thirtyDaysAgo }
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

export const startCleanupJob = () => {
    if (process.env.ENABLE_CLEANUP_JOB === 'true') {
        logger.info('[Clean up] Starting');
        cleanupTask.start();
    } else {
        logger.info('[Clean up] Cleanup DISABLED via config');
    }
};
