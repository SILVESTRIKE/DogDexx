import { Schema, model, Document } from 'mongoose';

const i18nStringSchema = new Schema({
  en: { type: String, required: true },
  vi: { type: String, required: true },
}, { _id: false });

export interface IAchievement extends Document {
  key: string;
  name: { en: string; vi: string };
  description: { en: string; vi: string };
  condition: {
    type: 'collection_count' | 'rare_breed' | 'all_breeds' | 'custom';
    value: number;
    breedSlug?: string;
  };
  icon?: string;
  isDeleted: boolean;
}

const AchievementSchema = new Schema<IAchievement>({
  key: { type: String, required: true, unique: true },
  name: { type: i18nStringSchema, required: true },
  description: { type: i18nStringSchema, required: true },
  condition: {
    type: {
      type: String,
      enum: ['collection_count', 'rare_breed', 'all_breeds', 'custom'],
      required: true
    },
    value: { type: Number, required: true },
    breedSlug: { type: String }
  },
  icon: { type: String },
  isDeleted: { type: Boolean, default: false, select: false },
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret: { [key: string]: any }) => {
      delete ret._id;
      delete ret.__v;
      delete ret.isDeleted;
    }
  },
  toObject: {
    transform: (doc, ret: { [key: string]: any }) => {
      delete ret._id;
      delete ret.__v;
    }
  }
});

export default model<IAchievement>('Achievement', AchievementSchema);
