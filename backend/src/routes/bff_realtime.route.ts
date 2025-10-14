import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = Router();

// This proxies WebSocket requests to the AI service for real-time detection
router.use('/', createProxyMiddleware({
    target: process.env.AI_SERVICE_URL || 'http://localhost:8000', // Assuming the live detection is on another path in the AI service
    ws: true,
    pathRewrite: { '^/bff/live': '/live-detection-stream' }, // Example rewrite path
}));

export default router;