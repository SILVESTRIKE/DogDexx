import { UserModel } from "../models/user.model";
import { PlanModel, PlanDoc } from "../models/plan.model"; // Sửa: Thêm PlanDoc
import { NotFoundError, BadRequestError } from "../errors";
import { TransactionModel } from "../models/transaction.model"; // THÊM: Import TransactionModel
import { SubscriptionModel, SubscriptionDoc } from "../models/subscription.model";
import { momoService } from "./momo.service"; // THÊM: Import momoService
import { v4 as uuidv4 } from 'uuid'; // THÊM: Dùng để tạo ID duy nhất
import { logger } from "../utils/logger.util";
import { PlanService } from "./plan.service"; // THÊM MỚI: Import PlanService
import { FilterQuery, Types } from 'mongoose';

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

  /**
   * [Admin] Lấy danh sách các GIAO DỊCH với bộ lọc và phân trang.
   */
  async getAllTransactions(options: { page: number; limit: number; search?: string; status?: string; planId?: string; }) {
    const { page = 1, limit = 10, search, status, planId } = options;
    const skip = (page - 1) * limit;

    const query: FilterQuery<any> = {};

    if (status) {
      query.status = status;
    }
    if (planId && planId !== 'all') {
      query.plan = planId;
    }
    if (search) {
      // Tìm kiếm user theo username hoặc email
      const users = await UserModel.find({
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(u => u._id);
      // Nếu không tìm thấy user nào, trả về kết quả rỗng
      if (userIds.length === 0) {
        return { data: [], pagination: { total: 0, page, limit, totalPages: 0 } };
      }
      query.user = { $in: userIds };
    }

    const [transactions, total] = await Promise.all([
      TransactionModel.find(query)
        .populate('user', 'username email')
        .populate('plan', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TransactionModel.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);
    return { data: transactions, pagination: { total, page, limit, totalPages } };
  },

  /**
   * [Admin] Lấy danh sách các ĐĂNG KÝ (SUBSCRIPTION) với bộ lọc và phân trang.
   */
  async getAllSubscriptions(options: { page: number; limit: number; search?: string; status?: SubscriptionDoc['status']; planId?: string; }) {
    const { page = 1, limit = 10, search, status, planId } = options;
    const skip = (page - 1) * limit;

    const query: FilterQuery<SubscriptionDoc> = { isDeleted: false };

    if (status) {
      query.status = status;
    }
    if (planId && planId !== 'all') {
      query.planId = new Types.ObjectId(planId);
    }
    if (search) {
      const users = await UserModel.find({
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(u => u._id);
      if (userIds.length === 0) {
        return { data: [], pagination: { total: 0, page, limit, totalPages: 0 } };
      }
      query.userId = { $in: userIds };
    }

    const [subscriptions, total] = await Promise.all([
      SubscriptionModel.find(query)
        .populate('userId', 'name email') // Lấy cả name và email
        .populate('planId', 'name')      // Giữ nguyên
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SubscriptionModel.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);
    return { data: subscriptions, pagination: { total, page, limit, totalPages } };
  },

  async handleMomoIpn(ipnPayload: any): Promise<void> {
    // Ensure the payload is logged as a proper JSON string for better debugging
    logger.info(`[MoMo IPN] Received IPN payload: ${JSON.stringify(ipnPayload, null, 2)}`);
    logger.info(`[MoMo IPN] Starting processing for orderId: ${ipnPayload.orderId}`);

    const isSignatureValid = momoService.verifyIpnSignature(ipnPayload);
    if (!isSignatureValid) {
      logger.error('[MoMo IPN] Invalid signature. Aborting.');
      // Không throw lỗi để tránh MoMo gửi lại, chỉ ghi log và bỏ qua
      return;
    }

    const { orderId, resultCode, message, transId, amount } = ipnPayload;

    // 2. Tìm giao dịch trong DB
    const transaction = await TransactionModel.findOne({ orderId });
    if (!transaction) {
      logger.error(`[MoMo IPN] Transaction with orderId ${orderId} not found.`);
      return;
    }

    // 3. Kiểm tra trạng thái giao dịch để tránh xử lý lại
    if (transaction.status !== 'pending') {
      logger.warn(`[MoMo IPN] Transaction ${orderId} is not in 'pending' state (current: ${transaction.status}). Ignoring.`);
      return;
    }

    // 4. Kiểm tra kết quả thanh toán từ MoMo
    if (resultCode === 0) { // Thanh toán thành công
      logger.info(`[MoMo IPN] Payment for orderId ${orderId} was successful.`);

      // Lấy thông tin user và plan
      const [user, plan] = await Promise.all([
        UserModel.findById(transaction.user),
        PlanModel.findById(transaction.plan)
      ]);

      if (!user || !plan) {
        logger.error(`[MoMo IPN] User or Plan not found for transaction ${orderId}.`);
        transaction.status = 'failed';
        transaction.rawIpnResponse = JSON.stringify(ipnPayload);
        await transaction.save();
        return;
      }

      // 5. Cập nhật giao dịch
      transaction.status = 'completed';
      transaction.gatewayTransactionId = transId;
      transaction.rawIpnResponse = JSON.stringify(ipnPayload); // Lưu lại toàn bộ payload để debug
      logger.info(`[MoMo IPN] Transaction status for orderId ${orderId} is being updated to 'completed'.`);

      // LƯU LẠI GIAO DỊCH TRƯỚC KHI TIẾP TỤC
      await transaction.save(); 
      // 6. Tạo hoặc cập nhật Subscription
      const now = new Date();
      const periodEnd = new Date(now);
      if (transaction.billingPeriod === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      }

      const newSubscription = await SubscriptionModel.create({
        userId: user._id,
        planId: plan._id,
        planSlug: plan.slug,
        provider: 'momo',
        providerSubscriptionId: `momo-${transId}`, // Tạo ID duy nhất cho subscription
        status: 'active',
        billingPeriod: transaction.billingPeriod,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });

      // Cập nhật subscriptionId cho transaction và lưu lại lần nữa
      transaction.subscriptionId = newSubscription._id;
      await transaction.save();

      logger.info(`[MoMo IPN] Transaction and Subscription for orderId ${orderId} updated successfully.`);
      
      // 7. CẬP NHẬT THÔNG TIN NGƯỜI DÙNG (FIX)
      await UserModel.findByIdAndUpdate(user._id, {
        $set: { plan: plan.slug, remainingTokens: plan.tokenAllotment, subscriptionId: newSubscription._id.toString() }
      });

      logger.info(`[MoMo IPN] User ${user.id} successfully upgraded to plan '${plan.slug}'. Processing finished.`);

    } else { // Thanh toán thất bại
      logger.warn(`[MoMo IPN] Payment for orderId ${orderId} failed. Reason: ${message} (code: ${resultCode})`);
      transaction.status = 'failed';
      transaction.rawIpnResponse = JSON.stringify(ipnPayload);
      await transaction.save(); // LƯU LẠI GIAO DỊCH SAU KHI CẬP NHẬT
      logger.info(`[MoMo IPN] Transaction status for orderId ${orderId} is being updated to 'failed'.`);
    }
  }
};