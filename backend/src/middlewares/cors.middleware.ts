import cors from 'cors';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.util';

dotenv.config();

const allowedOrigins: string[] = [
  'http://localhost:3001',
  'http://localhost:3000',
  "https://dogdexai.vercel.app",
  "https://dogdexx.vercel.app",
];

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
    if (!origin) {
      callback(null, true);
      return;
    }
    logger.info("Origin đang gọi tới:", origin);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: exposedHeaders,
});
