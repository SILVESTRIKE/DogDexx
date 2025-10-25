import { Request, Response, NextFunction } from 'express';
import { PlanService } from '../services/plan.service';

/**
 * Controller cho các endpoint công khai, không yêu cầu xác thực.
 */
export const bffPublicController = {
  /**
   * Lấy danh sách tất cả các gói cước công khai.
   */
  getPublicPlans: async (req: Request, res: Response, next: NextFunction) => {
    const plans = await PlanService.getPublicPlans();
    res.status(200).json({
      message: 'Lấy danh sách gói cước công khai thành công.',
      data: plans,
    });
  },

  /**
   * Lấy chi tiết một gói cước công khai bằng slug.
   */
  getPublicPlanBySlug: async (req: Request, res: Response, next: NextFunction) => {
    const { slug } = req.params;
    const plan = await PlanService.getBySlug(slug);
    res.status(200).json({
      message: `Lấy chi tiết gói cước '${slug}' thành công.`,
      data: plan,
    });
  },
};