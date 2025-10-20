import { Router } from "express";
import { AnalyticsEventModel } from "../models/analytics_event.model";
import { optionalAuthMiddleware } from "../middlewares/optionalAuth.middleware";

const router = Router();

/**
 * @route POST /api/analytics/track-visit
 * @desc Ghi nhận một lượt truy cập trang
 * @access Public
 */ 
router.post("/api/analytics/track-visit", optionalAuthMiddleware, async (req, res, next) => {
  try {
    // SỬA LỖI: Tối ưu việc ghi nhận lượt truy cập
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query: any = {
      eventName: 'PAGE_VISIT',
      date: today,
    };

    if (req.user?._id) {
      query.user = req.user._id;
    } else if (req.fingerprint?.hash) {
      query.fingerprint = req.fingerprint.hash;
    }

    const update = {
      $inc: { visitCount: 1 },
      $setOnInsert: {
        ip: req.ip,
        userAgent: req.headers["user-agent"],
        eventData: { page: req.body.page || "unknown" },
      },
    };

    await AnalyticsEventModel.findOneAndUpdate(query, update, {
      upsert: true, 
      new: true, 
    });

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
router.post("/api/analytics/track-event", optionalAuthMiddleware, async (req, res, next) => {
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