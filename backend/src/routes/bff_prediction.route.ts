import { Router } from "express";
import { bffPredictionController } from "../controllers/bff_prediction.controller";
import { uploadSingle, uploadMultiple } from "../middlewares/upload.middleware";
import { optionalAuthMiddleware } from "../middlewares/optionalAuth.middleware";
import { authMiddleware } from "../middlewares/auth.middleware";
import { checkTokenLimit } from "../middlewares/tokenLimiter.middleware";
import { tokenConfig } from "../config/token.config";
import { validate } from "../middlewares/validation.middleware";
import {
    PredictUrlSchema,
    FeedbackSchema,
    StreamResultSchema,
    ChatSchema,
} from "../types/zod/prediction.zod";
const router = Router();

/**
 * @swagger
 * /bff/predict/image:
 *   post:
 *     summary: "(BFF) Dự đoán từ một ảnh (Chi phí: 2 token)"
 *     tags: [BFF-Prediction]
 *     description: |
 *       Tải lên một file ảnh để nhận diện giống chó. 
 *       Endpoint này sử dụng `optionalAuthMiddleware` nên có thể được gọi bởi cả người dùng đã đăng nhập và khách.
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
 *                 description: File ảnh cần dự đoán.
 *     responses:
 *       200:
 *         description: Dự đoán thành công.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BffPredictionResponse'
 *       400:
 *         description: Bad Request - Không có file nào được tải lên.
 *       402:
 *         description: Payment Required - Người dùng đã đăng nhập nhưng không đủ token.
 *       429:
 *         description: Too Many Requests - Người dùng thử (guest) đã hết token.
 *       500:
 *         description: Lỗi máy chủ nội bộ.
 *
 */
router.post(
    "/image",
    optionalAuthMiddleware,
    uploadSingle,
    checkTokenLimit(tokenConfig.costs.imagePrediction, 'single'),
    bffPredictionController.predictImage
);
/**
 * @swagger
 * /bff/predict/video:
 *   post:
 *     summary: "(BFF) Dự đoán từ một video (Chi phí: 10 token)"
 *     tags: [BFF-Prediction]
 *     description: |
 *       Tải lên một file video để nhận diện giống chó. 
 *       Endpoint này sử dụng `optionalAuthMiddleware` nên có thể được gọi bởi cả người dùng đã đăng nhập và khách.
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
 *                 description: File video cần dự đoán.
 *     responses:
 *       200:
 *         description: Dự đoán thành công.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BffPredictionResponse'
 *       400:
 *         description: Bad Request - Không có file nào được tải lên.
 *       402:
 *         description: Payment Required - Người dùng đã đăng nhập nhưng không đủ token.
 *       429:
 *         description: Too Many Requests - Người dùng thử (guest) đã hết token.
 *       500:
 *         description: Lỗi máy chủ nội bộ.
 *
 */
router.post(
    "/video",
    optionalAuthMiddleware,
    uploadSingle,
    checkTokenLimit(tokenConfig.costs.videoPrediction, 'single'),
    bffPredictionController.predictVideo
);


/**
 * @swagger
 * /bff/predict/batch:
 *   post:
 *     summary: "(BFF) Dự đoán từ nhiều ảnh (Chi phí: 2 token/ảnh)"
 *     tags: [BFF-Prediction]
 *     description: |
 *       Tải lên nhiều file ảnh để nhận diện hàng loạt. 
 *       Endpoint này yêu cầu đăng nhập và sẽ tính phí token dựa trên số lượng ảnh tải lên.
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
 *                 description: Mảng các file ảnh cần dự đoán.
 *     responses:
 *       200:
 *         description: Dự đoán thành công.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BffPredictionResponse'
 *       400:
 *         description: Bad Request - Không có file nào được tải lên.
 *       402:
 *         description: Payment Required - Không đủ token để xử lý toàn bộ batch.
 *       500:
 *         description: Lỗi máy chủ nội bộ.
 *
 */
router.post(
    "/batch",
    authMiddleware, // Batch prediction yêu cầu đăng nhập
    uploadMultiple,
    checkTokenLimit(tokenConfig.costs.imagePrediction, 'batch'),
    bffPredictionController.predictBatch
);

/**
 * @swagger
 * /bff/predict/stream/save:
 *   post:
 *     summary: "(BFF) Lưu kết quả từ stream video (Miễn phí)"
 *     tags: [BFF-Prediction]
 *     description: |
 *       Lưu một frame từ stream video (đã được xử lý và có bounding box) như một kết quả dự đoán mới.
 *       Endpoint này được gọi từ client sau khi nhận kết quả từ websocket.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StreamResultPayload'
 *     responses:
 *       201: { description: "Lưu kết quả thành công." }
 *       400: { description: "Dữ liệu không hợp lệ." }
 *
 */
router.post(
    "/stream/save",
    optionalAuthMiddleware,
    validate(StreamResultSchema),
    bffPredictionController.saveStreamResult
);
/**
 * @swagger
 * /bff/predict/chat/{breedSlug}:
 *   post:
 *     summary: "(BFF) Trò chuyện với AI về một giống chó (Chi phí: 1 token)"
 *     tags: [BFF-Prediction]
 *     description: Gửi một tin nhắn để hỏi AI về một giống chó cụ thể.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: breedSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug của giống chó để trò chuyện.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: Nội dung câu hỏi của người dùng.
 *             example:
 *               message: "Giống chó này có thân thiện với trẻ em không?"
 *     responses:
 *       200:
 *         description: AI trả lời thành công.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reply:
 *                   type: string
 *       402:
 *         description: Payment Required - Người dùng đã đăng nhập nhưng không đủ token.
 *       429:
 *         description: Too Many Requests - Người dùng thử (guest) đã hết token.
 */
router.post(
    "/chat/:breedSlug",
    optionalAuthMiddleware,
    validate(ChatSchema),
    checkTokenLimit(tokenConfig.costs.chatMessage),
    bffPredictionController.chatWithGemini
);

/**
 * @swagger
 * /bff/predict/chat/{breedSlug}/history:
 *   get:
 *     summary: "(BFF) Lấy lịch sử trò chuyện về một giống chó (Miễn phí)"
 *     tags: [BFF-Prediction]
 *     description: Lấy toàn bộ lịch sử chat đã lưu trong Redis cho một phiên trò chuyện cụ thể.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: breedSlug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug của giống chó.
 *     responses:
 *       200:
 *         description: Trả về lịch sử chat thành công.
 */
router.get(
    "/chat/:breedSlug/history",
    optionalAuthMiddleware,
    bffPredictionController.getChatHistory
);

/**
 * @swagger
 * /bff/predict/{breedSlug}/health-recommendations:
 *   get:
 *     summary: "(BFF) Lấy gợi ý sức khỏe cho một giống chó (Miễn phí)"
 *     tags: [BFF-Prediction]
 *     description: Lấy các gợi ý về sức khỏe, chăm sóc dựa trên giống chó cụ thể.
 *     parameters:
 *       - in: path
 *         name: breedSlug
 *         required: true
 *         schema: { type: string }
 *         description: Slug của giống chó.
 *     responses:
 *       200:
 *         description: Trả về danh sách các gợi ý.
 */
router.get(
    "/:breedSlug/health-recommendations",
    optionalAuthMiddleware,
    bffPredictionController.getHealthRecommendations
);

/**
 * @swagger
 * /bff/predict/{breedSlug}/recommended-products:
 *   get:
 *     summary: "(BFF) Lấy sản phẩm gợi ý cho một giống chó (Miễn phí)"
 *     tags: [BFF-Prediction]
 *     description: Lấy danh sách các sản phẩm (thức ăn, đồ chơi, v.v.) phù hợp với giống chó cụ thể.
 *     parameters:
 *       - in: path
 *         name: breedSlug
 *         required: true
 *         schema: { type: string }
 *         description: Slug của giống chó.
 *     responses:
 *       200:
 *         description: Trả về danh sách các sản phẩm gợi ý.
 */
router.get(
    "/:breedSlug/recommended-products",
    optionalAuthMiddleware,
    bffPredictionController.getRecommendedProducts
);

// --- CÁC ROUTE KHÔNG TỐN TOKEN GIỮ NGUYÊN ---

/**
 * @swagger
 * /bff/predict/{id}/feedback:
 *   post:
 *     summary: "(BFF) Gửi phản hồi cho một dự đoán (Miễn phí)"
 *     tags: [BFF-Prediction]
 *     description: Gửi phản hồi về tính chính xác của một kết quả dự đoán. Có thể được gọi bởi cả người dùng đăng nhập và khách.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của kết quả dự đoán.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isCorrect:
 *                 type: boolean
 *                 description: Kết quả dự đoán có đúng không?
 *               submittedLabel:
 *                 type: string
 *                 description: "Nhãn (giống chó) đúng, nếu isCorrect là false."
 *               notes:
 *                 type: string
 *                 description: Ghi chú thêm.
 *             example:
 *               isCorrect: false
 *               submittedLabel: "Poodle"
 *               notes: "Tôi chắc chắn đây là giống Poodle."
 *     responses:
 *       201:
 *         description: Gửi phản hồi thành công.
 *       400:
 *         description: Dữ liệu gửi lên không hợp lệ.
 */
router.post("/:id/feedback", authMiddleware, validate(FeedbackSchema), bffPredictionController.submitFeedback);

/**
 * @swagger
 * /bff/predict/history:
 *   get:
 *     summary: "(BFF) Lấy lịch sử dự đoán của người dùng (Miễn phí)"
 *     tags: [BFF-Prediction]
 *     description: Lấy danh sách lịch sử dự đoán của người dùng đã đăng nhập. Yêu cầu xác thực.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng kết quả mỗi trang.
 *     responses:
 *       200:
 *         description: Lấy lịch sử thành công.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 histories:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PredictionHistoryItem'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *       401:
 *         description: Unauthorized - Yêu cầu đăng nhập.
 */
router.get("/history", authMiddleware, bffPredictionController.getPredictionHistory);

/**
 * @swagger
 * /bff/predict/history/{id}:
 *   get:
 *     summary: "(BFF) Lấy chi tiết một lịch sử dự đoán (Miễn phí)"
 *     tags: [BFF-Prediction]
 *     description: Lấy thông tin chi tiết của một mục trong lịch sử dự đoán bằng ID. Endpoint này không yêu cầu xác thực.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch sử dự đoán.
 *     responses:
 *       200:
 *         description: Lấy chi tiết thành công.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BffPredictionResponse'
 *       404:
 *         description: Not Found - Không tìm thấy lịch sử dự đoán.
 */
router.get("/history/:id", optionalAuthMiddleware, bffPredictionController.getPredictionHistoryById);

/**
 * @swagger
 * /bff/predict/status/{id}:
 *   get:
 *     summary: "(BFF) Lấy trạng thái xử lý dự đoán (Miễn phí)"
 *     tags: [BFF-Prediction]
 *     description: Kiểm tra trạng thái xử lý của một dự đoán đang trong hàng đợi hoặc bộ nhớ.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Trả về trạng thái xử lý. }
 */
router.get("/status/:id", optionalAuthMiddleware, bffPredictionController.getPredictionStatus);

/**
 * @swagger
 * /bff/predict/history/{id}:
 *   delete:
 *     summary: "(BFF) Xóa một lịch sử dự đoán (Miễn phí)"
 *     tags: [BFF-Prediction]
 *     description: Xóa một mục trong lịch sử dự đoán của người dùng. Yêu cầu xác thực.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Xóa thành công. }
 */
router.delete("/history/:id", authMiddleware, bffPredictionController.deletePredictionHistory);

/**
 * @swagger
 * /bff/predict/url:
 *   post:
 *     summary: "(BFF) Dự đoán từ URL ảnh (Chi phí: 2 token)"
 *     tags: [BFF-Prediction]
 *     description: |
 *       Gửi một URL ảnh để nhận diện giống chó.
 *       Endpoint này sử dụng `optionalAuthMiddleware`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 description: URL của ảnh cần dự đoán.
 *     responses:
 *       200:
 *         description: Dự đoán thành công.
 *       400:
 *         description: Bad Request - URL không hợp lệ.
 *       402:
 *         description: Payment Required.
 *       500:
 *         description: Lỗi máy chủ.
 */
router.post(
    "/url",
    optionalAuthMiddleware,
    validate(PredictUrlSchema),
    checkTokenLimit(tokenConfig.costs.imagePrediction, 'single'),
    bffPredictionController.predictUrl
);

/**
 * @swagger
 * /bff/predict/config:
 *   get:
 *     summary: "(BFF) Lấy cấu hình AI Service (Public)"
 *     tags: [BFF-Prediction]
 *     description: Lấy thông tin cấu hình hiện tại từ AI Service (ngưỡng confidence, model, v.v.).
 *     responses:
 *       200:
 *         description: Thành công.
 *       500:
 *         description: Lỗi kết nối AI Service.
 */
router.get(
    "/config",
    optionalAuthMiddleware,
    bffPredictionController.getConfig
);

export default router;