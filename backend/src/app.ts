import "express-async-errors";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import cookieParser from "cookie-parser";
import Fingerprint from "express-fingerprint";
import { errorHandlerMiddleware } from "./middlewares/errorHandler.middleware";
import { configureViewEngine } from "./config/viewEngine";
import authRoutes from "./routes/auth.route";
import userRoutes from "./routes/user.route";
import { predictionRoutes } from "./routes/prediction.route";
import { mediasRouter } from "./routes/medias.route";
import { wikiRoutes } from "./routes/dogs_wiki.route";
import { collectionRoutes } from "./routes/user_collection.route";
import { adminFeedbackRouter } from "./routes/feedback.route";
import { predictionHistoryRouter } from "./routes/prediction_history.route";
import { adminPredictionHistoryRouter } from "./routes/admin_prediction_history.route";
import swaggerUi from "swagger-ui-express";

import bffUserRoutes from './routes/bff_user.route';
import bffPredictionRoutes from './routes/bff_prediction.route';
import bffCollectionRoutes from './routes/bff_collection.route';
import bffContentRoutes from './routes/bff_content.route';
import bffAdminRoutes from './routes/bff_admin.route';
import bffRealtimeRoutes from './routes/bff_realtime.route';

// @ts-ignore - 
import swaggerSpec from '../swaggerConfig';

dotenv.config();
const app = express();
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173", // URL của frontend
  credentials: true, // Cho phép gửi credentials (cookies, headers xác thực)
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(Fingerprint());

configureViewEngine(app);
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use(
  "/processed-images",
  express.static(path.join(__dirname, "..", "public", "processed-images"))
);
app.use(
  "/processed-videos",
  express.static(path.join(__dirname, "..", "public", "processed-videos"))
);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
app.get("/test", (req, res) => {
  res.render("test");
});
import achievementRoute from './routes/achievement.route';

// BFF Routes
app.use('/bff/user', bffUserRoutes);
app.use('/bff/predict', bffPredictionRoutes);
app.use('/bff/collection', bffCollectionRoutes);
app.use('/bff/content', bffContentRoutes);
app.use('/bff/admin', bffAdminRoutes);
app.use('/bff/live', bffRealtimeRoutes);

app.use(authRoutes);
app.use(achievementRoute);
app.use(userRoutes);
app.use(predictionRoutes);
app.use(mediasRouter);
app.use(wikiRoutes);
app.use(collectionRoutes);
app.use(adminFeedbackRouter);
app.use(predictionHistoryRouter);
app.use(adminPredictionHistoryRouter);
app.use(errorHandlerMiddleware);
export default app;
