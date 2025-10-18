import mongoose from "mongoose";
import http from 'http';
import WebSocket from 'ws';
import { Request } from 'express';
import app from "./app"; // Import Express app của bạn
import { bffPredictionController } from './controllers/bff_prediction.controller';
import { authenticateSocket } from './middlewares/optionalAuth.middleware';
import { logger } from './utils/logger';
import { startSchedulers } from "./utils/scheduler";
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
    logger.info("✅ Đã kết nối thành công tới MongoDB.");
  } catch (error) {
    logger.error("❌ Lỗi kết nối MongoDB:", error);
    process.exit(1);
  }

  const PORT = process.env.PORT || 3000;

  // 1. Tạo một HTTP server từ Express app
  const server = http.createServer(app);

  // 2. Tạo một WebSocket server, nhưng không gắn nó vào HTTP server ngay
  const wss = new WebSocket.Server({ noServer: true });

  // 3. Lắng nghe sự kiện 'upgrade' trên HTTP server để xử lý các yêu cầu WebSocket
  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url || '';

    // Phân luồng xử lý dựa trên đường dẫn của WebSocket
    if (pathname.startsWith('/bff/predict/stream')) {
      // Endpoint này cho phép cả guest và user, dùng optionalAuth
      authenticateSocket(request, () => {
          wss.handleUpgrade(request, socket, head, (ws) => {
              logger.info(`[WebSocket] Connection established for stream prediction: ${pathname}`);
              bffPredictionController.handleStreamPrediction(ws, request as Request);
          });
      });
    } else if (pathname.startsWith('/bff/live')) {
      // Endpoint này YÊU CẦU xác thực (ví dụ)
      authenticateSocket(request, () => { // Giả sử authenticateSocket sẽ throw lỗi nếu không có token
          wss.handleUpgrade(request, socket, head, (ws) => {
              logger.info(`[WebSocket] Authenticated connection for live feed: ${pathname}`);
              // bffRealtimeController.handleLive(ws, request as Request); // Giao cho controller tương ứng
          });
      });
    } else {
      logger.warn(`[WebSocket] Connection rejected for unknown path: ${pathname}`);
      socket.destroy();
    }
  });

  // 4. Khởi động server
  server.listen(PORT, () => {
    logger.info(`🚀 HTTP Server đang chạy trên cổng: http://localhost:${PORT}`);
    logger.info(`🤖 AI Service đang chạy tại: ${process.env.AI_SERVICE_URL || 'http://localhost:8000'}`);
    startSchedulers();
    startCleanupJob();
  });
};

startServer();
