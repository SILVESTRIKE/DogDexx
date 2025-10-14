import { Router } from "express";
import { feedbackController } from "../controllers/feedback.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { checkAllowedRoles } from "../middlewares/role.middleware";
import { validateData } from "../middlewares/validateBody.middleware";
import {
  GetFeedbacksQuerySchema,
  UpdateFeedbackBodySchema,
  FeedbackIdParamsSchema,
  DeleteFeedbackQuerySchema,
  SubmitFeedbackBodySchema,
} from "../types/zod/feedback.zod";

const router = Router();

// === USER ROUTES ===
/**
 * @swagger
 * /api/feedback:
 *   post:
 *     summary: Gửi feedback
 *     description: Người dùng đã đăng nhập có thể gửi feedback cho một dự đoán.
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeedbackCreatePayload'
 *     responses:
 *       201:
 *         description: Feedback được gửi thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedbackResponse'
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
router.post(
  "/api/feedback",
  authMiddleware,
  validateData(SubmitFeedbackBodySchema, "body"),
  feedbackController.submit
);

// Lấy danh sách feedback (có phân trang và filter)
/**
 * @swagger
 * /api/feedback:
 *   get:
 *     summary: Lấy danh sách feedback
 *     description: Lấy danh sách feedback với hỗ trợ phân trang và lọc (chỉ dành cho admin).
 *     tags: [Feedback]
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ['pending_review', 'approved_for_training', 'rejected']
 *         description: Lọc theo trạng thái feedback
 *     responses:
 *       200:
 *         description: Danh sách feedback
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedFeedbackResponse'
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
  "/api/feedback",
  authMiddleware,
  checkAllowedRoles(["admin"]),
  validateData(GetFeedbacksQuerySchema, "query"),
  feedbackController.getFeedbacks
);

// Lấy chi tiết một feedback
/**
 * @swagger
 * /api/feedback/{id}:
 *   get:
 *     summary: Lấy chi tiết một feedback
 *     description: Lấy thông tin chi tiết của một feedback dựa trên ID (chỉ dành cho admin).
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của feedback
 *     responses:
 *       200:
 *         description: Thông tin chi tiết feedback
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedbackResponse'
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
 *         description: Không tìm thấy feedback
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/api/feedback/:id",
  authMiddleware,
  checkAllowedRoles(["admin"]),
  validateData(FeedbackIdParamsSchema, "params"),
  feedbackController.getFeedbackById
);

// Cập nhật trạng thái/ghi chú của một feedback
/**
 * @swagger
 * /api/feedback/{id}:
 *   patch:
 *     summary: Cập nhật trạng thái hoặc ghi chú của một feedback
 *     description: Cập nhật thông tin (trạng thái hoặc ghi chú) của một feedback (chỉ dành cho admin).
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của feedback
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeedbackCreatePayload'
 *     responses:
 *       200:
 *         description: Feedback được cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeedbackResponse'
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
 *         description: Không tìm thấy feedback
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  "/api/feedback/:id",
  authMiddleware,
  checkAllowedRoles(["admin"]),
  validateData(FeedbackIdParamsSchema, "params"),
  validateData(UpdateFeedbackBodySchema, "body"),
  feedbackController.updateFeedback
);

// Xóa một feedback (mặc định là xóa mềm, có tùy chọn xóa cứng)
/**
 * @swagger
 * /api/feedback/{id}:
 *   delete:
 *     summary: Xóa một feedback
 *     description: Xóa mềm hoặc xóa cứng một feedback dựa trên ID (chỉ dành cho admin).
 *     tags: [Feedback]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của feedback
 *       - in: query
 *         name: hardDelete
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Xóa cứng nếu true, xóa mềm nếu false
 *     responses:
 *       200:
 *         description: Feedback được xóa thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Feedback đã được xóa thành công
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
 *         description: Không tìm thấy feedback
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  "/api/feedback/:id",
  authMiddleware,
  checkAllowedRoles(["admin"]),
  validateData(FeedbackIdParamsSchema, "params"),
  validateData(DeleteFeedbackQuerySchema, "query"),
  feedbackController.deleteFeedback
);

export { router as adminFeedbackRouter };