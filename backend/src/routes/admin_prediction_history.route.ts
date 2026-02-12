import { Router } from 'express';
import { predictionHistoryController } from '../controllers/prediction_history.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { checkAllowedRoles } from '../middlewares/role.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
  HistoryIdParamsSchema,
  GetAdminHistoriesQuerySchema,
  DeleteHistoryQuerySchema,
} from '../types/zod/prediction.zod';

const router = Router();

/**
 * @swagger
 * /api/admin/histories:
 *   get:
 *     summary: Lấy toàn bộ lịch sử dự đoán
 *     description: Lấy danh sách tất cả lịch sử dự đoán với hỗ trợ phân trang (chỉ dành cho admin).
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
 *       403:
 *         description: Không đủ quyền (không phải admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/api/admin/histories',
  authMiddleware,
  checkAllowedRoles(['admin']),
  validate(GetAdminHistoriesQuerySchema, 'query'),
  predictionHistoryController.getAllHistory
);

/**
 * @swagger
 * /api/admin/histories/{id}:
 *   get:
 *     summary: Lấy chi tiết một lịch sử dự đoán
 *     description: Lấy thông tin chi tiết của một lịch sử dự đoán dựa trên ID (chỉ dành cho admin).
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
 *       403:
 *         description: Không đủ quyền (không phải admin)
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
  '/api/admin/histories/:id',
  authMiddleware,
  checkAllowedRoles(['admin']),
  validate(HistoryIdParamsSchema, 'params'),
  predictionHistoryController.getHistoryById
);

/**
 * @swagger
 * /api/admin/histories/{id}:
 *   delete:
 *     summary: Xóa một lịch sử dự đoán
 *     description: Xóa mềm hoặc xóa cứng một lịch sử dự đoán dựa trên ID (chỉ dành cho admin).
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
 *       - in: query
 *         name: hardDelete
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Xóa cứng nếu true, xóa mềm nếu false
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
 *       403:
 *         description: Không đủ quyền (không phải admin)
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
  '/api/admin/histories/:id',
  authMiddleware,
  checkAllowedRoles(['admin']),
  validate(HistoryIdParamsSchema, 'params'),
  validate(DeleteHistoryQuerySchema, 'query'),
  predictionHistoryController.deleteHistory
);

export { router as adminPredictionHistoryRouter };