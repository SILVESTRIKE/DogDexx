import { PlanModel, PlanDoc } from "../models/plan.model";
import { NotFoundError } from "../errors";

interface IPlanQuery {
  isDeleted?: boolean;
  isPublic?: boolean;
  slug?: string;
  // THÊM: Các tham số cho phân trang và tìm kiếm (dùng cho trang admin)
  page?: number;
  limit?: number;
  search?: string;
}

export const PlanService = {
  /**
   * Lấy danh sách các plan có phân trang và tìm kiếm (dành cho Admin).
   * @param query - Các tham số truy vấn như page, limit, search.
   * @returns Một đối tượng chứa dữ liệu plan và thông tin phân trang.
   */
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

  /**
   * Lấy tất cả các plan công khai (dành cho trang Pricing).
   * @returns Danh sách các plan công khai, không phân trang.
   */
  async getPublicPlans(): Promise<PlanDoc[]> {
    return PlanModel.find({ isDeleted: false})
      .sort({ order: 1 })
      .exec();
  },

  /**
   * Lấy một plan theo điều kiện.
   * @param query - Điều kiện lọc (ví dụ: slug, id)
   * @returns Một plan hoặc null.
   */
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

  /**
   * Tạo một gói cước mới.
   * @param planData - Dữ liệu của gói cước mới.
   * @returns Gói cước đã được tạo.
   */
  async create(planData: Partial<PlanDoc>): Promise<PlanDoc> {
    const newPlan = await PlanModel.create(planData);
    return newPlan.toObject();
  },

  /**
   * Cập nhật thông tin một gói cước.
   * @param id - ID của gói cước cần cập nhật.
   * @param updateData - Dữ liệu cập nhật.
   * @returns Gói cước đã được cập nhật hoặc null nếu không tìm thấy.
   */
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

  /**
   * Xóa mềm một gói cước (đặt isDeleted = true).
   * @param id - ID của gói cước cần xóa.
   * @returns Gói cước đã được xóa mềm.
   */
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
