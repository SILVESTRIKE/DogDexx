import { Request, Response } from "express";
import { bffPredictionService } from "../services/bff_prediction.service";

export const bffPredictionController = {
  upload: async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "Không có file nào được cung cấp." });
      }
      const job = await bffPredictionService.createJob(file, req.user?._id);
      return res.status(200).json({
        jobId: job.jobId,
        status: job.status,
        message: "Đã nhận file, đang xử lý..."
      });
    } catch (err) {
      return res.status(500).json({ message: "Lỗi hệ thống.", error: String(err) });
    }
  },

  getResult: async (req: Request, res: Response) => {
    try {
      const jobId = req.params.jobId;
      const job = await bffPredictionService.getJob(jobId);
      if (!job) {
        return res.status(404).json({ jobId, status: "not_found", error: "Job không tồn tại." });
      }
      if (job.status === "processing") {
        return res.status(200).json({ jobId, status: "processing", progress: job.progress || 0 });
      }
      if (job.status === "failed") {
        return res.status(200).json({ jobId, status: "failed", error: job.error });
      }
      // completed
      return res.status(200).json({ jobId, status: "completed", data: job.result });
    } catch (err) {
      return res.status(500).json({ message: "Lỗi hệ thống.", error: String(err) });
    }
  }
};
