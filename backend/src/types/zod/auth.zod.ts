import { z } from 'zod';

export const LoginPayloadSchema = z.object({
  email: z.string().email({ message: 'Email không hợp lệ.' }),
  password: z.string().min(1, { message: 'Mật khẩu không được để trống.' }),
});

export const RegisterPayloadSchema = z.object({
    username: z.string().min(3, { message: 'Tên người dùng phải có ít nhất 3 ký tự.' }),
    email: z.string().email({ message: 'Email không hợp lệ.' }),
    password: z.string().min(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự.' }),
});