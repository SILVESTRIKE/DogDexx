import mongoose, { Schema, Document } from 'mongoose';

/**
 * Reward Log Model
 * Tracks token rewards given to users
 */

export type RewardType = 'finder_reward' | 'referral' | 'achievement' | 'admin_grant' | 'other';

export interface RewardLogDoc extends Document {
    user_id: mongoose.Types.ObjectId;
    user_email: string;

    type: RewardType;
    amount: number;
    description: string;

    // Related entity
    related_dog_id?: mongoose.Types.ObjectId;
    related_post_id?: mongoose.Types.ObjectId;

    // Admin grant
    granted_by?: mongoose.Types.ObjectId;

    createdAt: Date;
}

const rewardLogSchema = new Schema<RewardLogDoc>(
    {
        user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        user_email: { type: String, required: true },

        type: {
            type: String,
            enum: ['finder_reward', 'referral', 'achievement', 'admin_grant', 'other'],
            required: true
        },
        amount: { type: Number, required: true },
        description: { type: String, required: true },

        related_dog_id: { type: Schema.Types.ObjectId, ref: 'DogProfile' },
        related_post_id: { type: Schema.Types.ObjectId, ref: 'CommunityPost' },
        granted_by: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    {
        timestamps: true,
        collection: 'reward_logs'
    }
);

// Index for analytics
rewardLogSchema.index({ createdAt: -1 });
rewardLogSchema.index({ type: 1, createdAt: -1 });

export const RewardLogModel = mongoose.model<RewardLogDoc>('RewardLog', rewardLogSchema);
