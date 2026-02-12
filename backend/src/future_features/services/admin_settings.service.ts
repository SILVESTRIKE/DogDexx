import { AppSettingModel, AppSettingDoc, DEFAULT_SETTINGS } from '../models/app_setting.model';
import { QrScanLogModel, QrScanLogDoc } from '../models/qr_scan_log.model';
import { RewardLogModel, RewardLogDoc } from '../models/reward_log.model';
import { PlanModel } from '../../models/plan.model';

/**
 * Admin Settings Service
 * Handles app settings, logs queries, and plan management
 */
export class AdminSettingsService {

    // =============== APP SETTINGS ===============

    /**
     * Initialize default settings if not exist
     */
    static async seedDefaultSettings(): Promise<void> {
        for (const setting of DEFAULT_SETTINGS) {
            await AppSettingModel.updateOne(
                { key: setting.key },
                { $setOnInsert: setting },
                { upsert: true }
            );
        }
    }

    /**
     * Get a setting value by key
     */
    static async getSetting(key: string): Promise<any> {
        const setting = await AppSettingModel.findOne({ key });
        return setting?.value;
    }

    /**
     * Get all settings
     */
    static async getAllSettings(): Promise<AppSettingDoc[]> {
        return AppSettingModel.find().sort({ category: 1, key: 1 });
    }

    /**
     * Update a setting
     */
    static async updateSetting(key: string, value: any, adminId: string): Promise<AppSettingDoc | null> {
        return AppSettingModel.findOneAndUpdate(
            { key },
            { value, updatedBy: adminId },
            { new: true }
        );
    }

    // =============== PLAN LIMITS ===============

    /**
     * Get all plans with their limits
     */
    static async getPlansWithLimits() {
        return PlanModel.find().select('name slug dogLimit healthRecordLimitPerDog tokenAllotment priceMonthly');
    }

    /**
     * Update plan limits
     */
    static async updatePlanLimits(planId: string, limits: { dogLimit?: number; healthRecordLimitPerDog?: number }) {
        return PlanModel.findByIdAndUpdate(planId, limits, { new: true });
    }

    // =============== QR SCAN LOGS ===============

    /**
     * Log a QR scan event
     */
    static async logQrScan(data: Partial<QrScanLogDoc>): Promise<QrScanLogDoc> {
        return QrScanLogModel.create(data);
    }

    /**
     * Get QR scan logs with pagination
     */
    static async getQrScanLogs(options: {
        page?: number;
        limit?: number;
        dogId?: string;
        ownerId?: string;
        fromDate?: Date;
        toDate?: Date;
    } = {}) {
        const { page = 1, limit = 20, dogId, ownerId, fromDate, toDate } = options;
        const skip = (page - 1) * limit;

        const query: any = {};
        if (dogId) query.dog_id = dogId;
        if (ownerId) query.owner_id = ownerId;
        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = fromDate;
            if (toDate) query.createdAt.$lte = toDate;
        }

        const [logs, total] = await Promise.all([
            QrScanLogModel.find(query)
                .populate('dog_id', 'name breed')
                .populate('owner_id', 'username email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            QrScanLogModel.countDocuments(query)
        ]);

        return { data: logs, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // =============== REWARD LOGS ===============

    /**
     * Log a reward event
     */
    static async logReward(data: Partial<RewardLogDoc>): Promise<RewardLogDoc> {
        return RewardLogModel.create(data);
    }

    /**
     * Get reward logs with pagination
     */
    static async getRewardLogs(options: {
        page?: number;
        limit?: number;
        userId?: string;
        type?: string;
        fromDate?: Date;
        toDate?: Date;
    } = {}) {
        const { page = 1, limit = 20, userId, type, fromDate, toDate } = options;
        const skip = (page - 1) * limit;

        const query: any = {};
        if (userId) query.user_id = userId;
        if (type) query.type = type;
        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = fromDate;
            if (toDate) query.createdAt.$lte = toDate;
        }

        const [logs, total] = await Promise.all([
            RewardLogModel.find(query)
                .populate('user_id', 'username email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            RewardLogModel.countDocuments(query)
        ]);

        return { data: logs, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    /**
     * Get reward statistics
     */
    static async getRewardStats() {
        const stats = await RewardLogModel.aggregate([
            {
                $group: {
                    _id: '$type',
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const totalTokensGiven = stats.reduce((sum, s) => sum + s.totalAmount, 0);

        return {
            byType: stats,
            totalTokensGiven,
            totalRewards: stats.reduce((sum, s) => sum + s.count, 0)
        };
    }
}
