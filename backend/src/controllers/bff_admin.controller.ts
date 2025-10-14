// BFF Admin Controller
import { Request, Response } from 'express';
import { configService } from '../services/config.service';

export const getDashboard = async (req: Request, res: Response) => {
  // TODO: Aggregate analytics for dashboard
  res.status(501).json({ message: 'Not implemented' });
};

export const getFeedback = async (req: Request, res: Response) => {
  // TODO: Combine feedback, user info, prediction details, breed info
  res.status(501).json({ message: 'Not implemented' });
};

export const getUsers = async (req: Request, res: Response) => {
  // TODO: Get users, enrich with collection stats and prediction history
  res.status(501).json({ message: 'Not implemented' });
};

export const getModelConfig = async (req: Request, res: Response) => {
  const config = await configService.getModelConfig();
  res.status(200).json({
    message: 'Lấy cấu hình model thành công.',
    data: config,
  });
};

export const updateModelConfig = async (req: Request, res: Response) => {
  const updatedConfig = await configService.updateModelConfig(req.body);
  res.status(200).json({ message: 'Cập nhật cấu hình model thành công.', data: updatedConfig });
};

export const getAlerts = async (req: Request, res: Response) => {
  // TODO: Aggregate alerts
  res.status(501).json({ message: 'Not implemented' });
};
