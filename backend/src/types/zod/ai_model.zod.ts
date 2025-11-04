import { z } from "zod";

export const CreateAIModelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  path: z.string().min(1, "Path is required"),
  version: z.string().min(1, "Version is required"),
  task: z.enum(["classification", "detection", "segmentation"]),
});
export type CreateAIModelType = z.infer<typeof CreateAIModelSchema>;

export const UpdateAIModelSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional(),
  path: z.string().min(1, "Path is required").optional(),
  version: z.string().min(1, "Version is required").optional(),
  task: z.enum(["classification", "detection", "segmentation"]).optional(),
});
export type UpdateAIModelType = z.infer<typeof UpdateAIModelSchema>;
export const AIModelIdParamsSchema = z.object({
  id: z.string().refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ID format",
  }),
});
