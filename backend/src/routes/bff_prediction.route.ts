import { Router } from "express";
import { bffPredictionController } from "../controllers/bff_prediction.controller";
import { uploadSingle, uploadMultiple } from "../middlewares/upload.middleware";
import { optionalAuthMiddleware } from "../middlewares/optionalAuth.middleware";

const router = Router();
router.use(optionalAuthMiddleware);

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
router.post("/image", uploadSingle, bffPredictionController.predictImage);

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
router.post("/video", uploadSingle, bffPredictionController.predictVideo);

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
router.post("/batch", uploadMultiple, bffPredictionController.predictBatch);

/**
 * @swagger
 * /bff/predict/stream:
 *   get:
 *     summary: (BFF) Kết nối WebSocket cho dự đoán streaming
 *     tags: [BFF-Prediction]
 *     description: "Kết nối WebSocket để dự đoán giống chó theo thời gian thực. Route này sẽ proxy trực tiếp đến AI service. Đăng nhập là tùy chọn, nếu đăng nhập sẽ áp dụng giới hạn sử dụng."
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       101:
 *         description: Chuyển đổi giao thức sang WebSocket thành công.
 *       401:
 *         description: Không được phép (vượt quá giới hạn sử dụng).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       502:
 *         description: Lỗi proxy khi kết nối với dịch vụ AI.
 *         content:
 *           application/json: {}
 */
router.get('/stream', (req, res) => {
  // Đây là một placeholder. Logic thực sự nằm ở server 'upgrade' event.
  // Nếu một client HTTP GET thông thường gọi đến đây, báo lỗi.
  res.status(426).send('Upgrade Required: This endpoint requires a WebSocket connection.');
});

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
router.post("/:id/feedback", bffPredictionController.submitFeedback);

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
router.get("/history", bffPredictionController.getPredictionHistory);
