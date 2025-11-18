import dotenv from "dotenv";
dotenv.config();
import { apiLimiter } from "./middlewares/rateLimiter.middleware";
import express from "express";
import cors from "cors";
import path from "path";
import cookieParser from "cookie-parser";
import Fingerprint from 'express-fingerprint';

import { errorHandlerMiddleware } from "./middlewares/errorHandler.middleware";
import { corsMiddleware } from "./middlewares/cors.middleware";
import { configureViewEngine } from "./config/viewEngine";
import analyticsRoutes from "./routes/analytics.route";
import "./utils/redis.util";

import bffUserRoutes from './routes/bff_user.route';
import bffPredictionRoutes from './routes/bff_prediction.route';
import bffCollectionRoutes from './routes/bff_collection.route';
import bffContentRoutes from './routes/bff_content.route';
import bffAdminRoutes from './routes/bff_admin.route';
import bffPublicRoutes from './routes/bff_public.route';

import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import { options as swaggerOptions } from "../swaggerConfig.js";

const swaggerSpec = swaggerJSDoc(swaggerOptions);
const app = express();

app.use(corsMiddleware);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use((Fingerprint as any)({
  parameters: [
    (Fingerprint as any).useragent,
    (Fingerprint as any).geoip,
  ]
}));

// --- Swagger Routes ---

app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(undefined, {
  swaggerUrl: '/api-docs.json',
  swaggerOptions: { tryItOutEnabled: true }
}));

app.get("/test", (req, res) => {
  configureViewEngine(app);
  res.render("test");
});

// 1. Middleware phục vụ file tĩnh
const publicDirectory = path.join(__dirname, "..", "public");
app.use('/public', express.static(publicDirectory));
const datasetDirectory = path.join(__dirname, "..", "public", "dataset");
app.use('/public/dataset', express.static(datasetDirectory));


app.use(apiLimiter);

// 2. BFF (Backend-for-Frontend) Routes
app.use('/bff/user', bffUserRoutes);
app.use('/bff/predict', bffPredictionRoutes);
app.use('/bff/collection', bffCollectionRoutes);
app.use('/bff/content', bffContentRoutes);
app.use('/bff/admin', bffAdminRoutes);
app.use('/bff/public', bffPublicRoutes);
 
// 3. Core API Routes
app.use(analyticsRoutes);
// app.use(authRoutes);
// app.use(achievementRoute);
// app.use(userRoutes);
// app.use(predictionRoutes);
// app.use(mediasRouter);
// app.use(wikiRoutes);
// app.use(collectionRoutes);
// app.use(adminFeedbackRouter);
// app.use(aiModelsRoutes);
// app.use(predictionHistoryRouter);
// app.use(adminPredictionHistoryRouter);

// 4. Middleware xử lý lỗi cuối cùng
app.use(errorHandlerMiddleware);
export default app;