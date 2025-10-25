import { UserModel } from "../models/user.model";
import { PlanModel, PlanDoc } from "../models/plan.model"; // Sửa: Thêm PlanDoc
import { NotFoundError, BadRequestError } from "../errors";
import { TransactionModel } from "../models/transaction.model"; // THÊM: Import TransactionModel
import { momoService } from "./momo.service"; // THÊM: Import momoService
import { v4 as uuidv4 } from 'uuid'; // THÊM: Dùng để tạo ID duy nhất
import { logger } from "../utils/logger.util";
import { PlanService } from "./plan.service"; // THÊM MỚI: Import PlanService

// XÓA: Không cần giả lập URL nữa
export const subscriptionService = {
  /**
   * Lấy danh sách tất cả các gói cước công khai có sẵn.
   * TÁI SỬ DỤNG LOGIC TỪ PlanService để đảm bảo tính nhất quán.
   */
  async getAvailablePlans(): Promise<PlanDoc[]> {
    const plans = await PlanService.getPublicPlans();
    if (!plans || plans.length === 0) {
      throw new NotFoundError("Không tìm thấy gói cước nào.");
    }
    // Chuyển đổi kết quả để phù hợp với frontend
    return plans.map(plan => ({
      ...plan.toObject(),
      id: plan._id.toString(), // Đảm bảo có 'id'
    }));
  },


  async createCheckoutSession(userId: string, planSlug: string, billingPeriod: "monthly" | "yearly") {
    // 1. Lấy thông tin người dùng và gói cước từ DB
    const [user, plan] = await Promise.all([
      UserModel.findById(userId),
      PlanService.getBySlug(planSlug) // SỬA: Dùng PlanService để lấy plan
    ]);

    if (!user) throw new NotFoundError("Không tìm thấy người dùng");
    if (!plan) throw new NotFoundError("Không tìm thấy gói cước");

    // 2. Kiểm tra xem người dùng có đang cố nâng cấp lên chính gói hiện tại không
    if (user.plan === plan.slug) {
      throw new BadRequestError("Bạn đã đang ở gói cước này.");
    }

    const amount = billingPeriod === "monthly" ? plan.priceMonthly : plan.priceYearly;
    if (amount <= 0 && plan.slug !== 'free') {
      logger.warn(`Attempting to upgrade to a paid plan '${plan.slug}' with zero cost.`);
    }

    // --- Bắt đầu tích hợp MoMo ---
    // 3. Tạo thông tin đơn hàng cho MoMo
    const orderId = uuidv4(); // Tạo một orderId duy nhất
    const requestId = orderId;
    const orderInfo = `Nâng cấp tài khoản lên gói ${plan.name} (${billingPeriod === 'monthly' ? 'tháng' : 'năm'})`;

    // THAY ĐỔI: Lưu thông tin giao dịch vào DB trước khi tạo yêu cầu thanh toán
    await TransactionModel.create({
      orderId,
      user: user._id,
      plan: plan._id,
      planSlug: plan.slug,
      amount,
      billingPeriod,
      paymentGateway: 'momo',
      status: 'pending',
    });
    logger.info(`[Transaction] Created pending transaction ${orderId} for user ${userId}`);

    // 4. Gọi momoService để tạo yêu cầu thanh toán
    const momoResponse = await momoService.createPaymentRequest(amount, orderInfo, orderId, requestId);

    // 5. Trả về payUrl và các thông tin khác từ MoMo cho controller
    // Controller sẽ gửi các URL này về cho frontend để thực hiện chuyển hướng.
    return { payUrl: momoResponse.payUrl, deeplink: momoResponse.deeplink };
  },
};