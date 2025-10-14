import { z } from 'zod';
import mongoose from 'mongoose';

// --- Schemas cho luồng USER ---
export const SubmitFeedbackBodySchema = z.object({
  predictionId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Prediction ID không hợp lệ.',
  }),
  isCorrect: z.boolean(),
  submittedLabel: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

// --- Schemas cho luồng ADMIN ---
export const FeedbackIdParamsSchema = z.object({
  id: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Feedback ID không hợp lệ.',
  }),
});

export const GetFeedbacksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  status: z.enum(['pending_review', 'approved_for_training', 'rejected']).optional(),
  search: z.string().optional(),
});

export const UpdateFeedbackBodySchema = z.object({
  status: z.enum(['pending_review', 'approved_for_training', 'rejected']).optional(),
  notes: z.string().trim().optional(),
});

export const DeleteFeedbackQuerySchema = z.object({
  force: z.coerce.boolean().default(false).optional(),
});