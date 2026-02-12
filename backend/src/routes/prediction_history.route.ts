import { Router } from "express";
import { predictionHistoryController } from "../controllers/prediction_history.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { checkAllowedRoles } from "../middlewares/role.middleware";
import { validate } from "../middlewares/validation.middleware";
import {
  HistoryIdParamsSchema,
  GetHistoriesQuerySchema,
} from "../types/zod/prediction.zod";

const router = Router();

/**
 * @swagger
 * /api/histories:
 *   get:
 *     summary: Lấy lịch sử dự đoán của người dùng
 *     description: Lấy danh sách lịch sử dự đoán của người dùng hiện tại.
 *     tags: [PredictionHistory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *         description: Số trang (bắt đầu từ 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *         description: Số lượng kết quả mỗi trang
 *     responses:
 *       200:
 *         description: Danh sách lịch sử dự đoán
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedPredictionHistoryResponse'
 */

/**
 * @swagger
 * /api/histories:
 *   get:
 *     summary: Lấy lịch sử dự đoán của người dùng hiện tại
 *     description: Lấy danh sách lịch sử dự đoán của người dùng đã đăng nhập với hỗ trợ phân trang.
 *     tags: [PredictionHistory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *         description: Số lượng bản ghi mỗi trang
 *     responses:
 *       200:
 *         description: Danh sách lịch sử dự đoán
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedPredictionHistoryResponse'
 *       400:
 *         description: Yêu cầu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Không được phép (chưa đăng nhập)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/api/histories",
  authMiddleware,
  validate(GetHistoriesQuerySchema, "query"),
  predictionHistoryController.getHistoryForCurrentUser
);

/**
 * @swagger
 * /api/histories/{id}:
 *   get:
 *     summary: Lấy chi tiết một lịch sử dự đoán
 *     description: Lấy thông tin chi tiết của một lịch sử dự đoán dựa trên ID của người dùng hiện tại.
 *     tags: [PredictionHistory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của lịch sử dự đoán
 *     responses:
 *       200:
 *         description: Thông tin chi tiết lịch sử dự đoán
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PredictionHistoryResponse'
 *       400:
 *         description: Yêu cầu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Không được phép (chưa đăng nhập)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy lịch sử dự đoán
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/api/histories/:id',
  authMiddleware,
  validate(HistoryIdParamsSchema, 'params'),
  predictionHistoryController.getHistoryByIdForCurrentUser
);

/**
 * @swagger
 * /api/histories/{id}:
 *   get:
 *     summary: Lấy chi tiết một lịch sử dự đoán 
 *     description: Lấy thông tin chi tiết của một lịch sử dự đoán theo ID
 *     tags: [PredictionHistory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch sử dự đoán
 *     responses:
 *       200:
 *         description: Chi tiết lịch sử dự đoán
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PredictionHistoryResponse'
 */

/**
 * @swagger
 * /api/histories/{id}:
 *   delete:
 *     summary: Xóa một lịch sử dự đoán
 *     description: Xóa mềm một lịch sử dự đoán dựa trên ID của người dùng hiện tại.
 *     tags: [PredictionHistory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của lịch sử dự đoán
 *     responses:
 *       200:
 *         description: Lịch sử dự đoán được xóa thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Lịch sử dự đoán đã được xóa thành công
 *       400:
 *         description: Yêu cầu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Không được phép (chưa đăng nhập)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy lịch sử dự đoán
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  "/api/histories/:id",
  authMiddleware,
  validate(HistoryIdParamsSchema, "params"),
  predictionHistoryController.deleteHistoryForCurrentUser
);

export { router as predictionHistoryRouter };