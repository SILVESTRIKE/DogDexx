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
import aiModelsRoutes from "./routes/ai_models.route";
import analyticsRoutes from "./routes/analytics.route";

import bffUserRoutes from './routes/bff_user.route';
import bffPredictionRoutes from './routes/bff_prediction.route';
import bffCollectionRoutes from './routes/bff_collection.route';
import bffContentRoutes from './routes/bff_content.route';
import bffAdminRoutes from './routes/bff_admin.route';
import achievementRoute from './routes/achievement.route';
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";
import { options as swaggerOptions } from "../swaggerConfig.js";

const swaggerSpec = swaggerJSDoc(swaggerOptions);
dotenv.config();
const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3001",
  "http://localhost:3000",
];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: "Origin, X-Requested-With, Content-Type, Accept, Authorization",
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(Fingerprint());

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

// 2. BFF (Backend-for-Frontend) Routes
app.use('/bff/user', bffUserRoutes);
app.use('/bff/predict', bffPredictionRoutes);
app.use('/bff/collection', bffCollectionRoutes);
app.use('/bff/content', bffContentRoutes);
app.use('/bff/admin', bffAdminRoutes);
 
// 3. Core API Routes
app.use(analyticsRoutes);
app.use(authRoutes);
app.use(achievementRoute);
app.use(userRoutes);
app.use(predictionRoutes);
app.use(mediasRouter);
app.use(wikiRoutes);
app.use(collectionRoutes);
app.use(adminFeedbackRouter);
app.use(aiModelsRoutes);
app.use(predictionHistoryRouter);
app.use(adminPredictionHistoryRouter);

// 4. Middleware xử lý lỗi cuối cùng
app.use(errorHandlerMiddleware);
export default app;