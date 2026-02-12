import { z } from "zod";
import { objectIdSchema } from "./user.zod";

export const HistoryIdParamsSchema = z.object({
  id: objectIdSchema,
});

export const GetHistoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const GetAdminHistoriesQuerySchema = GetHistoriesQuerySchema.extend({
  userId: objectIdSchema.optional(),
  search: z.string().optional(),
});

export const DeleteHistoryQuerySchema = z.object({
  hard: z.enum(['true', 'false']).optional(),
});

export const PredictUrlSchema = z.object({
  body: z.object({
    url: z.string().url({ message: "URL không hợp lệ" }),
  }),
});

export const FeedbackSchema = z.object({
  body: z.object({
    isCorrect: z.boolean(),
    submittedLabel: z.string().optional(),
    notes: z.string().optional(),
  }),
  params: z.object({
    id: objectIdSchema,
  }),
});

export const StreamResultSchema = z.object({
  body: z.object({
    processed_media_base64: z.string().min(1, "Base64 string is required"),
    media_type: z.string().optional(), // "image" | "video"
    detections: z.array(z.any()), // Có thể định nghĩa kỹ hơn nếu cần
  }),
});

export const ChatSchema = z.object({
  body: z.object({
    message: z.string().min(1, "Tin nhắn không được để trống"),
  }),
  params: z.object({
    breedSlug: z.string().min(1, "Slug giống chó không được để trống"),
  }),
});
