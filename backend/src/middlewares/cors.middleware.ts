import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

// Khởi tạo danh sách các origin được phép
const allowedOrigins: string[] = [
  'http://localhost:3001', // Frontend dev
  'http://localhost:3000', // Backend dev
  "https://dogdexai.vercel.app",
  "https://dogdexx.vercel.app",
];

// Chỉ thêm các URL từ biến môi trường nếu chúng tồn tại
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);
if (process.env.BACKEND_URL) allowedOrigins.push(process.env.BACKEND_URL);
if (process.env.RENDER_EXTERNAL_URL) allowedOrigins.push(process.env.RENDER_EXTERNAL_URL);

const exposedHeaders = [
  'X-User-Tokens-Limit',
  'X-User-Tokens-Remaining',
  'X-Trial-Tokens-Limit',
  'X-Trial-Tokens-Remaining',
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Luôn cho phép các yêu cầu không có origin (ví dụ: Postman, mobile apps)
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: exposedHeaders,
});
