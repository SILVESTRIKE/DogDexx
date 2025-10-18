// Achievement model
import { Schema, model, Document } from 'mongoose';

export interface IAchievement extends Document {
  key: string; // unique achievement key
  name: string;
  description: string;
  condition: {
    type: 'collection_count' | 'rare_breed' | 'all_breeds' | 'custom';
    value: number;
    breedSlug?: string;
  };
  icon?: string;
}

const AchievementSchema = new Schema<IAchievement>({
  key: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  condition: {
    type: {
      type: String,
      enum: ['collection_count', 'rare_breed', 'all_breeds', 'custom'],
      required: true
    },
    value: { type: Number, required: true },
    breedSlug: { type: String }
  },
  icon: { type: String }
});

export default model<IAchievement>('Achievement', AchievementSchema);
