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
