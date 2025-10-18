import { Router, Request, Response } from "express";
import { createProxyMiddleware, Options } from "http-proxy-middleware";
import { optionalAuthMiddleware } from "../middlewares/optionalAuth.middleware";
import { checkUsageLimit } from "../middlewares/usageLimiter.middleware";
import { uploadSingle } from "../middlewares/upload.middleware";
import { predictionController } from "../controllers/prediction.controller";
<<<<<<< Updated upstream
import dotenv from "dotenv";
import { ClientRequest, IncomingMessage, ServerResponse } from "http";
=======
import { setMediaType } from "../middlewares/setMediaType.middleware";
import { checkAllowedRoles } from "../middlewares/role.middleware";
import * as dotenv from "dotenv";
import { IncomingMessage, ServerResponse, ClientRequest } from "http";
import jwt from 'jsonwebtoken';
>>>>>>> Stashed changes
import { Socket } from "net";

dotenv.config();

const router = Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// 1. Route cho dự đoán ảnh (có lưu vào DB)
router.post(
  "/api/predictions/image",
  // optionalAuthMiddleware,
  // checkUsageLimit("image"),
  uploadSingle,
  predictionController.predictImage
);

// 2. Route cho dự đoán video (có lưu vào DB)
router.post(
<<<<<<< Updated upstream
  "/api/predictions/video",
  // optionalAuthMiddleware,
  // checkUsageLimit("video"),
  uploadSingle,
  predictionController.predictVideo
);


// === ROUTE DỰ ĐOÁN REAL-TIME (KHÔNG LƯU LỊCH SỬ) ===

=======
  "/api/predictions/stream-result",
  optionalAuthMiddleware,
  predictionController.saveStreamResult
);

/**
 * @swagger
 * /api/predictions/status/{predictionId}:
 *   get:
 *     summary: Kiểm tra trạng thái dự đoán
 *     description: "Kiểm tra tiến trình xử lý của một dự đoán (ví dụ: batch hoặc video lớn). Trả về phần trăm hoàn thành hoặc trạng thái hiện tại."
 *     tags: [Predictions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: predictionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của dự đoán cần kiểm tra trạng thái
 *     responses:
 *       200:
 *         description: Trạng thái dự đoán
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 progress:
 *                   type: number
 *                   example: 75
*                 status:
 *                   type: string
 *                   example: "processing"
 *       404:
 *         description: Không tìm thấy dự đoán
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/api/predictions/status/:predictionId",
  optionalAuthMiddleware,
  predictionController.getPredictionStatus
);

router.post(
  "/api/predictions/stream-result",
  optionalAuthMiddleware,
  setMediaType(),
  checkUsageLimit,
  predictionController.saveStreamResult
);

// === ROUTE DỰ ĐOÁN REAL-TIME ===
/**
 * @swagger
 * /api/predict/stream:
 *   get:
 *     summary: Dự đoán giống chó theo thời gian thực (WebSocket)
 *     description: Kết nối WebSocket để dự đoán giống chó theo thời gian thực từ hình ảnh/video. Route này sẽ proxy trực tiếp đến AI service (FastAPI) tại {AI_SERVICE_URL}/predict-stream. Đăng nhập là tùy chọn.
 *     tags: [Predictions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       101:
 *         description: Kết nối WebSocket được thiết lập thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Không được phép (nếu vượt quá giới hạn sử dụng)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       502:
 *         description: Lỗi proxy khi kết nối với dịch vụ AI
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
>>>>>>> Stashed changes
const proxyOptions: Options = {
  target: AI_SERVICE_URL,
  ws: true,
  changeOrigin: true,
    pathRewrite: (path, req) => {
      console.log(`[HPM] pathRewrite original path: ${path}`);
      const newPath = path.replace(/^.*/, '/predict-stream');
      console.log(`[HPM] pathRewrite new path: ${newPath}`);
      return newPath;
    },
<<<<<<< Updated upstream
    on: {
      error: (err: Error, req: IncomingMessage, res: ServerResponse | Socket) => {
        console.error('[HPM] Proxy Error:', err);
        if (res instanceof ServerResponse) {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
          }
          res.end('Proxy Error');
        } else if (res instanceof Socket) {
          res.destroy(err);
        }
      },
      proxyReqWs: (proxyReq: ClientRequest, req: IncomingMessage, socket: Socket, options: Options, head: Buffer) => {
        console.log(`[HPM] Proxying WebSocket request to: ${options.target?.toString()}`);
      },
    }
=======
    error: (err, req, res) => {
      console.error('[HPM] Proxy Error:', err);
      if ('writeHead' in res) {
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({ message: "Proxy Error: Could not connect to AI service." }));
      } else {
        // For WebSocket upgrade requests, the response is a socket.
        (res as Socket).destroy(err);
      }
    },
    proxyReqWs: (proxyReq: ClientRequest, req: IncomingMessage, socket: Socket, options: Options, head: Buffer) => {
      // --- LOGIC XÁC THỰC WEBSOCKET MỚI ---
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (token) {
        try {
          jwt.verify(token, process.env.JWT_SECRET!);
          console.log(`[HPM-Auth] Valid token found for user. Proxying WebSocket request to: ${options.target?.toString()}`);
        } catch (error: any) {
          console.warn(`[HPM-Auth] Invalid token for WebSocket: ${error.message}. Closing connection.`);
          // Gửi mã lỗi 4001 (custom) và đóng socket
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return; // Ngăn không cho proxy tiếp tục
        }
      } else {
        // Đây là người dùng khách (guest), vẫn cho phép kết nối
        console.log(`[HPM-Auth] No token found (guest user). Proxying WebSocket request to: ${options.target?.toString()}`);
      }
    },
  }
>>>>>>> Stashed changes
};

router.use(
  "/api/predict/stream",
<<<<<<< Updated upstream
=======
  // Middleware HTTP (optionalAuth, checkUsageLimit) không hoạt động với WebSocket upgrade requests.
  // Logic xác thực đã được chuyển vào onProxyReqWs.
>>>>>>> Stashed changes
  createProxyMiddleware(proxyOptions)
);

export { router as predictionRoutes };