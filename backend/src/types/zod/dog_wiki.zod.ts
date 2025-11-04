import { z } from 'zod';

// Schema cơ bản cho các trường của một giống chó.
// Hầu hết các trường đều là optional để có thể tái sử dụng cho cả tạo mới và cập nhật.
const BreedBaseSchema = z.object({
  breed: z.string({ required_error: "Tên giống chó là bắt buộc." }).min(1, "Tên giống chó không được để trống."),
  description: z.string({ required_error: "Mô tả là bắt buộc." }).min(1, "Mô tả không được để trống."),
  origin: z.string().optional(),
  group: z.string().optional(),
  life_expectancy: z.string().optional(),
  temperament: z.array(z.string()).optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  coat_type: z.string().optional(),
  coat_colors: z.array(z.string()).optional(),
  energy_level: z.number().min(1).max(5).optional(),
  trainability: z.number().min(1).max(5).optional(),
  shedding_level: z.number().min(1).max(5).optional(),
  maintenance_difficulty: z.number().min(1).max(5).optional(),
  rarity_level: z.number().min(1).max(5).optional(),
  good_with_children: z.boolean().optional(),
  good_with_other_pets: z.boolean().optional(),
  suitable_for: z.array(z.string()).optional(),
  unsuitable_for: z.array(z.string()).optional(),
  climate_preference: z.string().optional(),
  favorite_foods: z.array(z.string()).optional(),
  common_health_issues: z.array(z.string()).optional(),
  trainable_skills: z.array(z.string()).optional(),
  fun_fact: z.string().optional(),
  mediaUrl: z.string().url("URL media không hợp lệ.").optional(),
});

/**
 * Schema để validate khi tạo một giống chó mới.
 * Kế thừa từ schema cơ bản.
 */
export const CreateBreedSchema = BreedBaseSchema;

/**
 * Schema để validate khi cập nhật một giống chó.
 * Tất cả các trường đều là optional.
 */
export const UpdateBreedSchema = BreedBaseSchema.partial();
