import { z } from "zod";
import { Types } from "mongoose";

/**
 * Schema để validate một chuỗi có phải là MongoDB ObjectId hợp lệ không.
 * Đây là schema quan trọng nhất, sẽ được dùng trong toàn bộ dự án.
 */
export const objectIdSchema = z.string().refine(
  (val) => {
    return Types.ObjectId.isValid(val);
  },
  {
    message: "ID không phải là một ObjectId hợp lệ.",
  }
);

// --- BASE SCHEMAS ---
const email = z
  .string()
  .min(1, "Email không được để trống.")
  .email("Định dạng email không hợp lệ.");

const password = z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự.");

const username = z
  .string()
  .min(3, "Tên người dùng phải có ít nhất 3 ký tự.")
  .max(50, "Tên người dùng không được vượt quá 50 ký tự.");

const otp = z
  .string()
  .length(6, "Mã OTP phải có đúng 6 ký tự.")
  .regex(/^[0-9]{6}$/, "Mã OTP chỉ được chứa 6 chữ số.");

// --- AUTH SCHEMAS ---
export const RegisterSchema = z.object({
  body: z
    .object({
      username,
      email,
      password,
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    })
    .strict(),
});
export type RegisterType = z.infer<typeof RegisterSchema.shape.body>;

export const LoginSchema = z.object({
  body: z.object({ email, password }).strict(),
});
export type LoginType = z.infer<typeof LoginSchema.shape.body>;

export const ResendVerificationOtpSchema = z.object({
  body: z.object({ email }).strict(),
});
export type ResendVerificationOtpType = z.infer<
  typeof ResendVerificationOtpSchema.shape.body
>;

export const VerifyEmailSchema = z.object({
  body: z.object({ email, otp }).strict(),
});
export type VerifyEmailType = z.infer<typeof VerifyEmailSchema.shape.body>;

export const ForgotPasswordSchema = z.object({
  body: z.object({ email }).strict(),
});
export type ForgotPasswordType = z.infer<
  typeof ForgotPasswordSchema.shape.body
>;

export const ResetPasswordSchema = z.object({
  body: z.object({ email, otp, password }).strict(),
});
export type ResetPasswordType = z.infer<typeof ResetPasswordSchema.shape.body>;

// --- USER SCHEMAS ---
export const UpdateProfileSchema = z.object({
  body: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    })
    .strict(),
});
export type UpdateProfileType = z.infer<typeof UpdateProfileSchema.shape.body>;

// --- PARAMS & QUERY SCHEMAS ---
export const IdParamsSchema = z.object({
  params: z.object({ id: objectIdSchema }),
});
export type IdParamsType = z.infer<typeof IdParamsSchema.shape.params>;

/**
 * Dùng để validate query string khi lấy danh sách người dùng, ví dụ:
 * GET /api/users?page=1&limit=10&role=admin&search=john
 */
export const GetUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().optional().default(10),
    search: z.string().optional(),
    role: z.enum(["user", "admin"]).optional(),
  })
  .strict();
export type GetUsersQueryType = z.infer<typeof GetUsersQuerySchema>;
