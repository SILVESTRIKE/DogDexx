import { v4 as uuidv4 } from "uuid";
import { Types } from "mongoose";
import { PredictionHistoryDoc } from "../models/prediction_history.model";
import { predictionService } from "./prediction.service";

interface Job {
  jobId: string;
  status: "processing" | "completed" | "failed";
  progress?: number;
  error?: string;
  result?: PredictionHistoryDoc;
  createdAt: number;
}

const jobs: Record<string, Job> = {};

export const bffPredictionService = {
  createJob: async (file: Express.Multer.File, userId?: Types.ObjectId) => {
    const jobId = uuidv4();
    jobs[jobId] = {
      jobId,
      status: "processing",
      createdAt: Date.now(),
    };
    // Xử lý dự đoán bất đồng bộ
    (async () => {
      try {
        const result = await predictionService.makePrediction(userId, file, (file.mimetype.startsWith("image/") ? "image" : "video"), {} as any);
        jobs[jobId].status = "completed";
        jobs[jobId].result = result;
      } catch (err: any) {
        jobs[jobId].status = "failed";
        jobs[jobId].error = err?.message || "Unknown error";
      }
    })();
    return jobs[jobId];
  },

  getJob: async (jobId: string) => {
    return jobs[jobId];
  }
};
