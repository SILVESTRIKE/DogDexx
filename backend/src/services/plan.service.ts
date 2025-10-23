import { PlanModel, PlanDoc } from "../models/plan.model";
import { NotFoundError } from "../errors";

export interface CreatePlanInput {
  name: string;
  slug: string;
  priceMonthly: number;
  priceYearly: number;
  imageLimit: number;
  videoLimit: number;
  storageLimitGB: number;
  apiAccess: boolean;
}

export class PlanService {
  static async getAll(options: { page?: number, limit?: number, search?: string } = {}): Promise<{ data: PlanDoc[], total: number, page: number, limit: number, totalPages: number }> {
    const { page = 1, limit = 10, search } = options;
    const skip = (page - 1) * limit;
    const query: any = { isDeleted: false };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ];
    }

    const [plans, total] = await Promise.all([
      PlanModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PlanModel.countDocuments(query)
    ]);

    return {
      data: plans,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async getBySlug(slug: string): Promise<PlanDoc> {
    const plan = await PlanModel.findOne({ slug, isDeleted: false });
    if (!plan) throw new NotFoundError("Không tìm thấy gói cước");
    return plan;
  }

  static async create(data: CreatePlanInput): Promise<PlanDoc> {
    const plan = new PlanModel(data);
    return await plan.save();
  }

  static async update(id: string, data: Partial<CreatePlanInput>): Promise<PlanDoc> {
    const plan = await PlanModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    if (!plan) throw new NotFoundError("Không tìm thấy gói cước");
    return plan;
  }
}