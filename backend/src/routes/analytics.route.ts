import { Router } from "express";
import { optionalAuthMiddleware } from "../middlewares/optionalAuth.middleware";
import { trackVisit, trackEvent } from "../controllers/analytics.controller";

const router = Router();

/**
 * @route POST /track-visit
 * @desc Ghi nhận một lượt truy cập trang
 * @access Public
 */
router.post("/track-visit", optionalAuthMiddleware, trackVisit);

/**
 * @swagger
 * /track-event:
 *   post:
 *     summary: Ghi nhận một sự kiện tùy chỉnh
 *     tags: [Analytics]
 *     description: Ghi nhận một sự kiện từ client, ví dụ như một lượt dự đoán thành công.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventName: { type: string, example: 'SUCCESSFUL_PREDICTION' }
 *               eventData: { type: object, example: { predictionId: '...' } }
 *     responses:
 *       200:
 *         description: Ghi nhận sự kiện thành công.
 */
router.post("/track-event", optionalAuthMiddleware, trackEvent);

export default router;