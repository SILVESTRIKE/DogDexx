import { Request, Response } from 'express';
import { predictionHistoryService } from '../services/prediction_history.service';
import { transformMediaURLs } from '../utils/media.util';

export const predictionHistoryController = {

  getHistoryForCurrentUser: async (req: Request, res: Response) => {
    const result = await predictionHistoryService.getHistoryForUser(req.user!._id, req.query);
    const transformedHistories = result.histories.map(h => transformMediaURLs(req, h));
    res.status(200).json({
      message: 'Lấy lịch sử dự đoán thành công.',
      data: { ...result, histories: transformedHistories },
    });
  },

  getHistoryByIdForCurrentUser: async (req: Request, res: Response) => {
    const history = await predictionHistoryService.getHistoryByIdForUser(req.user!._id, req.params.id);
    const responseData = transformMediaURLs(req, history.toObject());
    res.status(200).json({
      message: 'Lấy chi tiết lịch sử dự đoán thành công.',
      data: responseData,
    });
  },

  deleteHistoryForCurrentUser: async (req: Request, res: Response) => {
    await predictionHistoryService.deleteHistoryForUser(req.user!._id, req.params.id);
    res.status(200).json({
      message: 'Xóa lịch sử dự đoán thành công.',
    });
  },

  // --- Admin-facing controllers ---

  getAllHistory: async (req: Request, res: Response) => {
    const result = await predictionHistoryService.getAllHistory(req.query);
    const transformedHistories = result.histories.map(h => transformMediaURLs(req, h));
    res.status(200).json({
      message: 'Lấy toàn bộ lịch sử dự đoán thành công.',
      data: { ...result, histories: transformedHistories },
    });
  },

  getHistoryById: async (req: Request, res: Response) => {
    const history = await predictionHistoryService.getHistoryById(req.params.id);
    const responseData = transformMediaURLs(req, history.toObject());
    res.status(200).json({
      message: 'Lấy chi tiết lịch sử dự đoán thành công.',
      data: responseData,
    });
  },

  deleteHistory: async (req: Request, res: Response) => {
    const hardDelete = req.query.hard === 'true';
    await predictionHistoryService.deleteHistory(req.params.id, hardDelete);
    res.status(200).json({
      message: `Đã ${hardDelete ? 'xóa vĩnh viễn' : 'xóa mềm'} lịch sử dự đoán thành công.`,
    });
  },
};
