import { z } from 'zod';

export const LoginPayloadSchema = z.object({
  email: z.string().email({ message: 'Email không hợp lệ.' }),
  password: z.string().min(1, { message: 'Mật khẩu không được để trống.' }),
});

export const RegisterPayloadSchema = z.object({
  username: z.string().min(3, { message: 'Tên người dùng phải có ít nhất 3 ký tự.' }),
  email: z.string().email({ message: 'Email không hợp lệ.' }),
  password: z
    .string()
    .min(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
    .regex(/[A-Z]/, { message: 'Mật khẩu phải chứa ít nhất một chữ hoa.' })
    .regex(/[a-z]/, { message: 'Mật khẩu phải chứa ít nhất một chữ thường.' })
    .regex(/[0-9]/, { message: 'Mật khẩu phải chứa ít nhất một số.' })
    .regex(/[^A-Za-z0-9]/, { message: 'Mật khẩu phải chứa ít nhất một ký tự đặc biệt.' }),
});