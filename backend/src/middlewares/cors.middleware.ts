import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const allowedOrigins = [
  'http://localhost:3001', // Frontend dev
  'http://localhost:3000', // Backend dev
  "https://dogdexai.vercel.app",
  process.env.FRONTEND_URL || '',
  process.env.BACKEND_URL || '',
  // Thêm các domain của bạn ở đây khi deploy
];

const exposedHeaders = [
  'X-User-Tokens-Limit',
  'X-User-Tokens-Remaining',
  'X-Trial-Tokens-Limit',
  'X-Trial-Tokens-Remaining',
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: exposedHeaders,
});
