import { Router } from "express";
import { bffPredictionController } from "../controllers/bff_prediction.controller";
import { uploadSingle } from "../middlewares/upload.middleware";

const router = Router();

router.post("/api/predictions/upload", uploadSingle, bffPredictionController.upload);
router.get("/api/predictions/result/:jobId", bffPredictionController.getResult);

export default router;
