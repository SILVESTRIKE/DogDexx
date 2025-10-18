import { Router } from "express";
import { AnalyticsEventModel, AnalyticsEventName } from "../models/analytics_event.model";
import Fingerprint from "express-fingerprint";
import { optionalAuthMiddleware } from "../middlewares/optionalAuth.middleware";

const router = Router();

/**
 * @route POST /track-visit
 * @desc Ghi nhận một lượt truy cập trang
 * @access Public
 */ 
router.post("/api/analytics/track-visit", optionalAuthMiddleware, Fingerprint(), async (req, res, next) => {
  try {
    const { page } = req.body;
    
    const eventPayload: any = {
      eventName: "PAGE_VISIT",
      eventData: { page: page || "unknown" },
      fingerprint: req.fingerprint?.hash,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    };

    if (req.user?._id) {
      eventPayload.user = req.user._id;
    }

    await AnalyticsEventModel.create(eventPayload);
    res.status(200).json({ message: "Visit tracked successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/analytics/track-event:
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
router.post("/api/analytics/track-event", optionalAuthMiddleware, Fingerprint(), async (req, res, next) => {
  try {
    const { eventName, eventData } = req.body;
    
    const eventPayload: any = {
      eventName,
      eventData,
      fingerprint: req.fingerprint?.hash,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    };

    if (req.user?._id) {
      eventPayload.user = req.user._id;
    }

    await AnalyticsEventModel.create(eventPayload);
    res.status(200).json({ message: "Event tracked" });
  } catch (error) {
    next(error);
  }
});

export default router;