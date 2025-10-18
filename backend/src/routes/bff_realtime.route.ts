import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { optionalAuthMiddleware } from '../middlewares/optionalAuth.middleware';
const router = Router();
router.use(optionalAuthMiddleware);

// This proxies WebSocket requests to the AI service for real-time detection
router.use('/', createProxyMiddleware({
    target: process.env.AI_SERVICE_URL || 'http://localhost:8000', // Assuming the live detection is on another path in the AI service
    ws: true,
    pathRewrite: { '^/bff/live': '/predict-stream' }, // Thống nhất với endpoint của AI service
}));

export default router;