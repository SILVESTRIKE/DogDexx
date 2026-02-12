import { Request, Response, NextFunction } from 'express';
import { AdminSettingsService } from '../services/admin_settings.service';

/**
 * Admin Settings Controller
 * Handles admin API endpoints for settings and logs
 */

// =============== APP SETTINGS ===============

export async function getAllSettings(req: Request, res: Response, next: NextFunction) {
    try {
        const settings = await AdminSettingsService.getAllSettings();
        res.send(settings);
    } catch (err) {
        next(err);
    }
}

export async function updateSetting(req: Request, res: Response, next: NextFunction) {
    try {
        const { key } = req.params;
        const { value } = req.body;
        const adminId = req.user!.id;

        const updated = await AdminSettingsService.updateSetting(key, value, adminId);
        if (!updated) {
            return res.status(404).send({ message: 'Setting not found' });
        }
        res.send(updated);
    } catch (err) {
        next(err);
    }
}

// =============== PLAN LIMITS ===============

export async function getPlans(req: Request, res: Response, next: NextFunction) {
    try {
        const plans = await AdminSettingsService.getPlansWithLimits();
        res.send(plans);
    } catch (err) {
        next(err);
    }
}

export async function updatePlanLimits(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;
        const { dogLimit, healthRecordLimitPerDog } = req.body;

        const updated = await AdminSettingsService.updatePlanLimits(id, {
            dogLimit,
            healthRecordLimitPerDog
        });

        if (!updated) {
            return res.status(404).send({ message: 'Plan not found' });
        }
        res.send(updated);
    } catch (err) {
        next(err);
    }
}

// =============== QR SCAN LOGS ===============

export async function getQrScanLogs(req: Request, res: Response, next: NextFunction) {
    try {
        const { page, limit, dogId, ownerId, fromDate, toDate } = req.query;

        const result = await AdminSettingsService.getQrScanLogs({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            dogId: dogId as string,
            ownerId: ownerId as string,
            fromDate: fromDate ? new Date(fromDate as string) : undefined,
            toDate: toDate ? new Date(toDate as string) : undefined
        });

        res.send(result);
    } catch (err) {
        next(err);
    }
}

// =============== REWARD LOGS ===============

export async function getRewardLogs(req: Request, res: Response, next: NextFunction) {
    try {
        const { page, limit, userId, type, fromDate, toDate } = req.query;

        const result = await AdminSettingsService.getRewardLogs({
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            userId: userId as string,
            type: type as string,
            fromDate: fromDate ? new Date(fromDate as string) : undefined,
            toDate: toDate ? new Date(toDate as string) : undefined
        });

        res.send(result);
    } catch (err) {
        next(err);
    }
}

export async function getRewardStats(req: Request, res: Response, next: NextFunction) {
    try {
        const stats = await AdminSettingsService.getRewardStats();
        res.send(stats);
    } catch (err) {
        next(err);
    }
}
