import mongoose, { Schema, Document } from 'mongoose';

export interface DogBreedWikiDoc extends Document {
  slug: string; // Key chính, ví dụ: "boxer"
  breed: string; // Tên giống chó, ví dụ: "Affenpinscher"
  pokedexNumber?: number; // Số thứ tự trong Pokedex
  group?: string; // Nhóm chó, ví dụ: "Working"
  origin?: string; // Nguồn gốc, ví dụ: "Germany"
  mediaPath?: string; // Đường dẫn ảnh đại diện
  coat_type?: string;
  coat_colors?: string[];
  description: string;
  life_expectancy?: string;
  temperament?: string[];
  height?: string;
  weight?: string;
  favorite_foods?: string[];
  common_health_issues?: string[];
  energy_level?: number; // thang 1-5
  trainability?: number; // thang 1-5
  shedding_level?: number; // thang 1-5
  rarity_level?: number; // thang 1-5
  good_with_children?: boolean;
  good_with_other_pets?: boolean;
  suitable_for?: string[];
  unsuitable_for?: string[];
  climate_preference?: string;
  maintenance_difficulty?: number; // thang 1-5
  trainable_skills?: string[];
  fun_fact?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const dogBreedWikiSchema = new Schema<DogBreedWikiDoc>({
  slug: { type: String, required: true, unique: true},
  breed: { type: String, required: true, text: true, index: true },
  pokedexNumber: { type: Number, unique: true, sparse: true },
  origin: { type: String },
  mediaPath: { type: String }, // Thêm trường mediaPath
  group: { type: String },
  coat_type: { type: String },
  coat_colors: { type: [String] },
  description: { type: String, required: true },
  life_expectancy: { type: String },
  temperament: { type: [String] },
  height: { type: String },
  weight: { type: String },
  favorite_foods: { type: [String] },
  common_health_issues: { type: [String] },
  energy_level: { type: Number, min: 1, max: 5 },
  trainability: { type: Number, min: 1, max: 5 },
  shedding_level: { type: Number, min: 1, max: 5 },
  good_with_children: { type: Boolean },
  good_with_other_pets: { type: Boolean },
  suitable_for: { type: [String] },
  unsuitable_for: { type: [String] },
  climate_preference: { type: String },
  maintenance_difficulty: { type: Number, min: 1, max: 5 },
  trainable_skills: { type: [String] },
  fun_fact: { type: String },
  isDeleted: { type: Boolean, default: false, select: false },
}, { 
  timestamps: true, // Tự động thêm createdAt và updatedAt
  collection: 'dog_breed_wikis',
  toJSON: {
    virtuals: true,
    transform: (doc: any, ret: any) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      delete ret.isDeleted;
    },
  },
  toObject: {
    virtuals: true,
    transform: (doc: any, ret: any) => {
      ret.id = ret._id.toString();
    },
  },
});

dogBreedWikiSchema.index({ group: 1, energy_level: 1, trainability: 1 });

export const DogBreedWikiModel = mongoose.model<DogBreedWikiDoc>('DogBreedWiki', dogBreedWikiSchema);