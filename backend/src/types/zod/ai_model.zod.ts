import { z } from "zod";

const modelTaskTypes = z.enum([
  "DOG_BREED_CLASSIFICATION",
  "CAT_BREED_CLASSIFICATION",
  "OBJECT_DETECTION",
]);

const modelFormatTypes = z.enum(["ONNX", "TENSORFLOW_JS", "PYTORCH"]);

const modelStatusTypes = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);

export const CreateAIModelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  taskType: modelTaskTypes,
  format: modelFormatTypes,
  fileName: z.string().min(1, "File name is required"),
  path: z.string().min(1, "Path is required"),
  labelsFileName: z.string().optional(),
  version: z.string().min(1, "Version is required"),
  status: modelStatusTypes.optional(),
  tags: z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch (error) {
        return val;
      }
    }
    return val;
  }, z.array(z.string()).optional()),
});
export type CreateAIModelType = z.infer<typeof CreateAIModelSchema>;

export const UpdateAIModelSchema = CreateAIModelSchema.partial();
export type UpdateAIModelType = z.infer<typeof UpdateAIModelSchema>;

export const AIModelIdParamsSchema = z.object({
  id: z.string().refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ID format",
  }),
});