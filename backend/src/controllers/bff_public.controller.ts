import { Request, Response, NextFunction } from 'express';
import { PlanService } from '../services/plan.service';

export const getPublicPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Lấy tất cả các plan, không phân trang cho trang public pricing
    const plans = await PlanService.getAll({ limit: 100 }); 
    res.status(200).json(plans);
  } catch (error) {
    next(error);
  }
};