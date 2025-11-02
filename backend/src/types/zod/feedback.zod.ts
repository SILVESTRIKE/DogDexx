import { z } from 'zod';
import mongoose from 'mongoose';

// --- Schemas cho luồng USER ---
export const SubmitFeedbackBodySchema = z.object({
  predictionId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Prediction ID không hợp lệ.',
  }),
  // isCorrect: z.boolean(), // Logic này sẽ được xử lý ở server dựa trên user_submitted_label
  submittedLabel: z.string().trim().min(1, 'Nhãn gợi ý không được để trống.'),
  notes: z.string().trim().optional(),
});

// --- Schemas cho luồng ADMIN ---
export const FeedbackIdParamsSchema = z.object({
  id: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Feedback ID không hợp lệ.',
  }),
});

export const RejectFeedbackBodySchema = z.object({
  reason: z.string().trim().min(10, 'Lý do từ chối phải có ít nhất 10 ký tự.'),
});

export const GetFeedbacksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  search: z.string().optional(),
});

export const UpdateFeedbackBodySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  notes: z.string().trim().optional(),
});

export const DeleteFeedbackQuerySchema = z.object({
  force: z.coerce.boolean().default(false).optional(),
});