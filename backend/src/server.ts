
import mongoose from "mongoose";
import http from 'http';
import expressWs from 'express-ws';
import app from "./app"; // Import Express app của bạn
import { bffPredictionController } from './controllers/bff_prediction.controller';
// THAY ĐỔI: Import middleware xác thực dành riêng cho WebSocket
import { wsOptionalAuthMiddleware } from './middlewares/wsOptionalAuth.middleware';
import { logger } from './utils/logger.util';
import { startSchedulers } from "./utils/scheduler.util";
import { startCleanupJob } from "./utils/cleanupafter30days.util";

const startServer = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI phải được định nghĩa trong file .env");
  }
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET phải được định nghĩa trong file .env");
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("[MongoDB] Connected on " + process.env.MONGO_URI + "");
  } catch (error) {
    logger.error("[MongoDB] Connection error:", error);
    process.exit(1);
  }

  const PORT = process.env.PORT || 3000;

  // THAY ĐỔI 3: Khởi tạo server và express-ws
  const server = http.createServer(app);
  // Khởi tạo express-ws và lấy lại đối tượng app đã được "vá"
  const wsInstance = expressWs(app, server);
  const { app: wsApp } = wsInstance;

  // THAY ĐỔI 4: Định nghĩa các route WebSocket bằng app.ws
  // Middleware (optionalAuthMiddleware) được thêm vào giống như route HTTP thông thường.
  // Middleware Fingerprint() đã chạy toàn cục trong app.ts nên không cần thêm ở đây.
  wsApp.ws('/bff/predict/stream', wsOptionalAuthMiddleware, bffPredictionController.handleStreamPrediction);
  wsApp.ws('/bff/live', wsOptionalAuthMiddleware, bffPredictionController.handleStreamPrediction);

  // Khởi động server (giữ nguyên)
  server.listen(PORT, () => {
    logger.info(`[Express] Connect on http://localhost:${PORT}`);
    startSchedulers();
    startCleanupJob();
  });
};

startServer();