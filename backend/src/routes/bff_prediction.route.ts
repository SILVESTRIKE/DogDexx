import { Router } from "express";
import { bffPredictionController } from "../controllers/bff_prediction.controller";
import { uploadSingle, uploadMultiple } from "../middlewares/upload.middleware";
import { createProxyMiddleware } from "http-proxy-middleware";
import { optionalAuthMiddleware } from "../middlewares/optionalAuth.middleware";

const router = Router();

router.post("/image", optionalAuthMiddleware, uploadSingle, bffPredictionController.predictImage);
router.post("/video", optionalAuthMiddleware, uploadSingle, bffPredictionController.predictVideo);
router.post("/batch", optionalAuthMiddleware, uploadMultiple, bffPredictionController.predictBatch);

// This proxies WebSocket requests to the AI service for real-time streaming
router.use('/stream', createProxyMiddleware({
    target: process.env.AI_SERVICE_URL || 'http://localhost:8000',
    ws: true,
    pathRewrite: { '^/bff/predict/stream': '/predict-stream' },
}));
router.post("/:id/feedback", optionalAuthMiddleware, bffPredictionController.submitFeedback);
router.get("/history", optionalAuthMiddleware, bffPredictionController.getPredictionHistory);

export default router;
