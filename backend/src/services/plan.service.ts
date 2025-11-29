import { PlanModel, PlanDoc } from "../models/plan.model";
import { NotFoundError } from "../errors";

interface IPlanQuery {
  isDeleted?: boolean;
  isPublic?: boolean;
  slug?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export const PlanService = {

  async getAllPaginated(
    query: IPlanQuery = {}
  ): Promise<{ data: PlanDoc[]; pagination: any }> {
    const { page = 1, limit = 10, search, ...filterQuery } = query;
    const finalFilter: any = { isDeleted: false, ...filterQuery };

    if (search) {
      finalFilter.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [plans, total] = await Promise.all([
      PlanModel.find(finalFilter)
        .sort({ order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PlanModel.countDocuments(finalFilter),
    ]);

    return {
      data: plans,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getPublicPlans(): Promise<PlanDoc[]> {
    return PlanModel.find({ isDeleted: false })
      .sort({ order: 1 })
      .exec();
  },

  async getOne(query: IPlanQuery): Promise<PlanDoc | null> {
    const finalQuery = { isDeleted: false, ...query };
    return PlanModel.findOne(finalQuery);
  },

  async getBySlug(slug: string): Promise<PlanDoc> {
    const plan = await this.getOne({ slug, isDeleted: false });
    if (!plan) {
      throw new NotFoundError(`Không tìm thấy gói cước với slug: ${slug}`);
    }
    return plan;
  },

  async create(planData: Partial<PlanDoc>): Promise<PlanDoc> {
    const newPlan = await PlanModel.create(planData);
    return newPlan.toObject();
  },

  async update(id: string, updateData: Partial<PlanDoc>): Promise<PlanDoc> {
    const updatedPlan = await PlanModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!updatedPlan)
      throw new NotFoundError(
        `Không tìm thấy gói cước với ID: ${id} để cập nhật.`
      );
    return updatedPlan;
  },

  async softDelete(id: string): Promise<PlanDoc> {
    const deletedPlan = await PlanModel.findByIdAndUpdate(
      id,
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!deletedPlan)
      throw new NotFoundError(`Không tìm thấy gói cước với ID: ${id} để xóa.`);
    return deletedPlan;
  },
};
