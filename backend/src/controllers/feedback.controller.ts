import { Request, Response } from 'express';
import { feedbackService } from '../services/feedback.service';

export const feedbackController = {
  // --- Cho USER ---
  async submit(req: Request, res: Response) {
    const userId = req.user!._id;
    const result = await feedbackService.submitFeedback(userId, req.body);
    res.status(201).json({ message: 'Cảm ơn bạn đã gửi phản hồi!', data: result });
  },

  // --- Cho ADMIN ---
  async getFeedbacks(req: Request, res: Response) {
    // Dữ liệu đã được Zod parse và gắn vào req.query
    const { page, limit, status, search } = req.query as any;
    const result = await feedbackService.getFeedbacks({ status, search }, { page, limit });
    res.status(200).json(result);
  },

  async getFeedbackById(req: Request, res: Response) {
    const feedback = await feedbackService.getFeedbackById(req.params.id);
    res.status(200).json({ data: feedback });
  },
  
  async updateFeedback(req: Request, res: Response) {
    const updatedFeedback = await feedbackService.updateFeedback(req.params.id, req.body);
    res.status(200).json({ message: 'Cập nhật feedback thành công.', data: updatedFeedback });
  },

  async deleteFeedback(req: Request, res: Response) {
    const { force } = req.query as any;
    const result = await feedbackService.deleteFeedback(req.params.id, force);
    res.status(200).json(result);
  },
};