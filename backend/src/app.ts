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
import achievementRoute from './routes/achievement.route';

// @ts-ignore - 
import swaggerSpec from '../swaggerConfig';

dotenv.config();
const app = express();

// --- FIX: Chuẩn hóa và đơn giản hóa cấu hình CORS ---
// Lấy URL của frontend từ biến môi trường, mặc định là http://localhost:3001
// Thêm cả http://localhost:3000 để hỗ trợ môi trường dev khi frontend chạy ở port mặc định.
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3001",
  "http://localhost:3000",
];

const corsOptions = {
  origin: allowedOrigins, // Cung cấp trực tiếp mảng các origin được phép
  credentials: true,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: "Origin, X-Requested-With, Content-Type, Accept, Authorization",
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(Fingerprint());

// Cấu hình thư mục public để phục vụ các file tĩnh (ảnh, video,...)
const publicDirectory = path.join(__dirname, "..", "public");
app.use('/public', express.static(publicDirectory));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
app.get("/test", (req, res) => {
  // Di chuyển configureViewEngine xuống đây để nó không ảnh hưởng đến các route khác
  configureViewEngine(app);
  res.render("test");
});

// BFF Routes
app.use('/bff/user', bffUserRoutes);
app.use('/bff/predict', bffPredictionRoutes);
app.use('/bff/collection', bffCollectionRoutes);
app.use('/bff/content', bffContentRoutes);
app.use('/bff/admin', bffAdminRoutes);
app.use('/bff/live', bffRealtimeRoutes);

// Core API Routes (Legacy or for other purposes)
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
