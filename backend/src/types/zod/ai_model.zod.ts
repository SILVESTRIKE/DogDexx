import { z } from "zod";

// Các type từ Mongoose model để Zod có thể sử dụng
const modelTaskTypes = z.enum([
  "DOG_BREED_CLASSIFICATION",
  "CAT_BREED_CLASSIFICATION",
  "OBJECT_DETECTION",
]);

const modelFormatTypes = z.enum(["ONNX", "TENSORFLOW_JS", "PYTORCH"]);

const modelStatusTypes = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);

// =============================================================
// SCHEMA ĐỂ TẠO MỚI MODEL (Hầu hết các trường là bắt buộc)
// =============================================================
export const CreateAIModelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  
  // SỬA: Đổi tên 'task' -> 'taskType' và cập nhật giá trị enum
  taskType: modelTaskTypes,
  
  // THÊM: Thêm các trường bắt buộc còn thiếu
  format: modelFormatTypes,
  huggingFaceRepo: z.string().min(1, "Hugging Face repository is required"),
  fileName: z.string().min(1, "File name is required"),
  path: z.string().min(1, "Path is required"),
  
  // THÊM: Thêm các trường không bắt buộc (vì có giá trị default trong Mongoose)
  labelsFileName: z.string().optional(),
  version: z.string().min(1, "Version is required"),
  status: modelStatusTypes.optional(),
tags: z.preprocess((val) => {
    // 1. Kiểm tra xem giá trị nhận được có phải là string không
    if (typeof val === 'string') {
      try {
        // 2. Nếu là string, thử parse nó thành JSON (từ '["a","b"]' thành ['a','b'])
        return JSON.parse(val);
      } catch (error) {
        // Nếu parse lỗi, trả về giá trị gốc để Zod báo lỗi sau
        return val;
      }
    }
    // 3. Nếu không phải string, trả về giá trị gốc
    return val;
  }, z.array(z.string()).optional()),
});
export type CreateAIModelType = z.infer<typeof CreateAIModelSchema>;


// =============================================================
// SCHEMA ĐỂ CẬP NHẬT MODEL (Tất cả các trường đều là optional)
// =============================================================
export const UpdateAIModelSchema = CreateAIModelSchema.partial();
// .partial() là một cách viết ngắn gọn của Zod để làm cho tất cả các trường
// trong một schema trở thành optional. Nó tương đương với việc bạn
// tự thêm .optional() vào từng trường.

export type UpdateAIModelType = z.infer<typeof UpdateAIModelSchema>;


// =============================================================
// SCHEMA ĐỂ VALIDATE PARAMS ID (Giữ nguyên)
// =============================================================
export const AIModelIdParamsSchema = z.object({
  id: z.string().refine((val) => /^[0-9a-fA-F]{24}$/.test(val), {
    message: "Invalid ID format",
  }),
});