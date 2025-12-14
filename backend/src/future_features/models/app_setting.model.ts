import mongoose, { Schema, Document } from 'mongoose';

/**
 * App Settings Model
 * Stores configurable settings for the application
 * Admin can update these without code changes
 */

export interface AppSettingDoc extends Document {
    key: string;
    value: any;
    description: string;
    category: 'rewards' | 'notifications' | 'limits' | 'general';
    updatedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

const appSettingSchema = new Schema<AppSettingDoc>(
    {
        key: { type: String, required: true, unique: true },
        value: { type: Schema.Types.Mixed, required: true },
        description: { type: String, required: true },
        category: {
            type: String,
            enum: ['rewards', 'notifications', 'limits', 'general'],
            default: 'general'
        },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    {
        timestamps: true,
        collection: 'app_settings'
    }
);

export const AppSettingModel = mongoose.model<AppSettingDoc>('AppSetting', appSettingSchema);

// Default settings to seed
export const DEFAULT_SETTINGS = [
    {
        key: 'finder_reward_tokens',
        value: 10,
        description: 'Số tokens thưởng cho người tìm thấy chó mất',
        category: 'rewards'
    },
    {
        key: 'health_reminder_hour',
        value: 8,
        description: 'Giờ gửi email nhắc lịch hẹn sức khỏe (0-23)',
        category: 'notifications'
    },
    {
        key: 'qr_scan_alert_cooldown',
        value: 30,
        description: 'Thời gian chờ giữa các email thông báo quét QR (phút)',
        category: 'notifications'
    }
];
