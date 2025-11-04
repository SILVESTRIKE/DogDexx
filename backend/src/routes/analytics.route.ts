import { Router } from "express";
import { optionalAuthMiddleware } from "../middlewares/optionalAuth.middleware";
import { AnalyticsEventName } from "../constants/analytics.events";
// THAY ĐỔI: Import service mới để xử lý logic
import { analyticsService } from "../services/analytics.service";

const router = Router();

/**
 * @route POST /api/analytics/track-visit
 * @desc Ghi nhận một lượt truy cập trang
 * @access Public
 */ 
router.post("/api/analytics/track-visit", optionalAuthMiddleware, async (req, res, next) => {
  try {
    // THAY ĐỔI: Toàn bộ logic upsert phức tạp được thay thế bằng một dòng gọi service
    await analyticsService.trackEvent({
      eventName: AnalyticsEventName.PAGE_VISIT,
      req,
      eventData: { page: req.body.page || "unknown" }
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
    
    // Kiểm tra xem eventName có hợp lệ không
    if (!Object.values(AnalyticsEventName).includes(eventName)) {
        return res.status(400).json({ message: "Invalid event name provided." });
    }

    // THAY ĐỔI: Logic tạo event được chuyển về service
    await analyticsService.trackEvent({
        eventName,
        req,
        eventData
    });

    res.status(200).json({ message: "Event tracked" });
  } catch (error)
    {
    next(error);
  }
});

export default router;