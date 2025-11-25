import mongoose from "mongoose";
import http from 'http';
import expressWs, { WebsocketRequestHandler } from 'express-ws';
import app from "./app"; 
import { bffPredictionController } from './controllers/bff_prediction.controller';
import { wsOptionalAuthMiddleware } from './middlewares/wsOptionalAuth.middleware';
import { logger } from './utils/logger.util';
import { startSchedulers } from "./utils/scheduler.util";
import { startCleanupJob } from "./utils/cleanupafter30days.util";
import { checkTokenLimit } from './middlewares/tokenLimiter.middleware'
import { tokenConfig } from './config/token.config';
import { Request, Response, NextFunction } from "express";
const startServer = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI phải được định nghĩa trong file .env");
  }
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET phải được định nghĩa trong file .env");
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("[MongoDB] Connected on " + process.env.MONGO_URI + "");

  } catch (error) {
    logger.error("[MongoDB] Connection error:", error);
    process.exit(1);
  }
  const PORT = process.env.PORT || 3000;

  const server = http.createServer(app);
  const wsInstance = expressWs(app, server);
  const { app: wsApp } = wsInstance;

  // Adapter to use express middleware with express-ws
  const wsMiddlewareAdapter = (middleware: (req: Request, res: Response, next: NextFunction) => void): WebsocketRequestHandler => {
    return (ws, req, next) => {
      // We don't have a real `res` object, but middleware might not use it.
      // If it does, this might need more work (e.g., creating a mock response).
      middleware(req, {} as Response, next);
    };
  };
  wsApp.ws('/bff/predict/stream', wsOptionalAuthMiddleware, wsMiddlewareAdapter(checkTokenLimit(tokenConfig.costs.streamSession, 'single')), bffPredictionController.handleStreamPrediction);

  server.listen(PORT, () => {
    logger.info(`[Express] Connect on http://localhost:${PORT}`);
    startSchedulers();
    startCleanupJob();
  });
};

startServer();