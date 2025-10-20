import mongoose from "mongoose";
import http from 'http';
import WebSocket from 'ws';
import { Request } from 'express';
import app from "./app"; // Import Express app của bạn
import { bffPredictionController } from './controllers/bff_prediction.controller';
import { authenticateSocket } from './middlewares/optionalAuth.middleware';
import { logger } from './utils/logger.util';
import { startSchedulers } from "./utils/scheduler.util";
import { startCleanupJob } from "./utils/cleanupafter30days.util";

// Ánh xạ đường dẫn WebSocket đến hàm xử lý tương ứng
const wsHandlers: { [key: string]: (ws: WebSocket, req: Request) => void } = {
  // Cả hai endpoint giờ đây đều dùng chung một handler đã hoàn thiện
  '/bff/predict/stream': bffPredictionController.handleStreamPrediction,
  '/bff/live': bffPredictionController.handleStreamPrediction, // SỬA LỖI: Trỏ endpoint /bff/live vào cùng handler
};

const startServer = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI phải được định nghĩa trong file .env");
  }
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET phải được định nghĩa trong file .env");
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("Đã kết nối thành công tới MongoDB.");
  } catch (error) {
    logger.error("Lỗi kết nối MongoDB:", error);
    process.exit(1);
  }

  const PORT = process.env.PORT || 3000;
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ noServer: true });

  // Lắng nghe sự kiện 'upgrade' trên HTTP server để xử lý các yêu cầu WebSocket
  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url || '';

    // Tìm handler phù hợp dựa trên đường dẫn
    const handlerKey = Object.keys(wsHandlers).find(key => pathname.startsWith(key));

    if (handlerKey) {
      // Xác thực người dùng (tùy chọn) trước khi nâng cấp kết nối
      authenticateSocket(request, () => {
        wss.handleUpgrade(request, socket, head, (ws) => {
            logger.info(`[WebSocket] Connection established for path: ${pathname}`);
            // Gọi handler tương ứng đã được định nghĩa trong `wsHandlers`
            wsHandlers[handlerKey](ws, request as Request);
        });
      });
    } else {
      logger.warn(`[WebSocket] Connection rejected for unknown path: ${pathname}`);
      socket.destroy();
    }
  });

  // Khởi động server
  server.listen(PORT, () => {
    logger.info(`HTTP Server đang chạy trên cổng: http://localhost:${PORT}`);
    logger.info(`AI Service đang chạy tại: ${process.env.AI_SERVICE_URL || 'http://localhost:8000'}`);
    startSchedulers();
    startCleanupJob();
  });
};

startServer();