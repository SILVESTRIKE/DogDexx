import "express-async-errors";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { errorHandlerMiddleware } from "./middlewares/errorHandler.middleware";
import { configureViewEngine } from "./config/viewEngine";

import authRoutes from "./routes/auth.route";
import userRoutes from "./routes/user.route";
import { predictionRoutes } from "./routes/prediction.route";
<<<<<<< Updated upstream
=======
import { mediasRouter } from "./routes/medias.route";
import { wikiRoutes } from "./routes/dogs_wiki.route";
import { collectionRoutes } from "./routes/user_collection.route";
import { adminFeedbackRouter } from "./routes/feedback.route";
import { predictionHistoryRouter } from "./routes/prediction_history.route";
import { adminPredictionHistoryRouter } from "./routes/admin_prediction_history.route";
// import aiModelsRoutes from "./routes/ai_models.route";
import analyticsRoutes from "./routes/analytics.route";
import "./utils/redis.util";
>>>>>>> Stashed changes

dotenv.config();
const app = express();

// Configure view engine
configureViewEngine(app);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// Add the test route
app.get("/test", (req, res) => {
  res.render("test");
});

app.use(authRoutes);
app.use(userRoutes);
app.use(predictionRoutes);
<<<<<<< Updated upstream
=======
app.use(mediasRouter);
app.use(wikiRoutes);
app.use(collectionRoutes);
app.use(adminFeedbackRouter);
// app.use(aiModelsRoutes);
app.use(predictionHistoryRouter);
app.use(adminPredictionHistoryRouter);

// 4. Middleware xử lý lỗi cuối cùng
>>>>>>> Stashed changes
app.use(errorHandlerMiddleware);

export default app;
