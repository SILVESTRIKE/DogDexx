import { Router } from "express";
import { bffPredictionController } from "../controllers/bff_prediction.controller";
import { uploadSingle, uploadMultiple } from "../middlewares/upload.middleware";
import { createProxyMiddleware } from "http-proxy-middleware";
import { optionalAuthMiddleware } from "../middlewares/optionalAuth.middleware";

const router = Router();

/**
 * @swagger
 * /bff/predict/image:
 *   post:
 *     summary: (BFF) Dự đoán từ một ảnh
 *     tags: [BFF-Prediction]
 *     description: Tải lên một ảnh, hệ thống sẽ dự đoán, cập nhật collection (nếu đăng nhập), và trả về kết quả dự đoán kèm thông tin chi tiết các giống chó.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Dự đoán thành công, trả về kết quả tổng hợp.
 */
router.post("/image", optionalAuthMiddleware, uploadSingle, bffPredictionController.predictImage);

/**
 * @swagger
 * /bff/predict/video:
 *   post:
 *     summary: (BFF) Dự đoán từ một video
 *     tags: [BFF-Prediction]
 *     description: Tải lên một video, hệ thống sẽ dự đoán, cập nhật collection (nếu đăng nhập), và trả về kết quả dự đoán kèm thông tin chi tiết các giống chó.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Dự đoán thành công, trả về kết quả tổng hợp.
 */
router.post("/video", optionalAuthMiddleware, uploadSingle, bffPredictionController.predictVideo);

/**
 * @swagger
 * /bff/predict/batch:
 *   post:
 *     summary: (BFF) Dự đoán từ nhiều ảnh
 *     tags: [BFF-Prediction]
 *     description: Tải lên nhiều ảnh cùng lúc để dự đoán hiệu quả hơn.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Dự đoán thành công.
 */
router.post("/batch", optionalAuthMiddleware, uploadMultiple, bffPredictionController.predictBatch);

/**
 * @swagger
 * /bff/predict/stream:
 *   get:
 *     summary: (BFF) Kết nối WebSocket cho dự đoán streaming
 *     tags: [BFF-Prediction]
 *     description: Endpoint này là một proxy cho kết nối WebSocket đến AI service. Sử dụng client WebSocket để kết nối.
 *     responses:
 *       101:
 *         description: Chuyển đổi giao thức sang WebSocket thành công.
 */
router.use('/stream', createProxyMiddleware({
    target: process.env.AI_SERVICE_URL || 'http://localhost:8000',
    ws: true,
    pathRewrite: { '^/bff/predict/stream': '/predict-stream' },
}));


export default router;

/**
 * @swagger
 * /bff/predict/{id}/feedback:
 *   post:
 *     summary: (BFF) Gửi phản hồi cho một dự đoán
 *     tags: [BFF-Prediction]
 *     description: Người dùng gửi phản hồi về tính chính xác của một kết quả dự đoán.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch sử dự đoán (PredictionHistory).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isCorrect:
 *                 type: boolean
 *               submittedLabel:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Gửi phản hồi thành công.
 */
router.post("/:id/feedback", optionalAuthMiddleware, bffPredictionController.submitFeedback);

/**
 * @swagger
 * /bff/predict/history:
 *   get:
 *     summary: (BFF) Lấy lịch sử dự đoán của người dùng
 *     tags: [BFF-Prediction]
 *     security:
 *       - bearerAuth: []
 *     description: Lấy danh sách lịch sử dự đoán của người dùng đã đăng nhập.
 *     responses:
 *       200:
 *         description: Lấy lịch sử thành công.
 */
router.get("/history", optionalAuthMiddleware, bffPredictionController.getPredictionHistory);
