import { UserModel } from "../models/user.model";
import { PlanModel, PlanDoc } from "../models/plan.model";
import { NotFoundError, BadRequestError } from "../errors";
import { TransactionModel } from "../models/transaction.model";
import { SubscriptionModel, SubscriptionDoc } from "../models/subscription.model";
import { momoService } from "./momo.service";
import { v4 as uuidv4 } from 'uuid';
import { logger } from "../utils/logger.util";
import { PlanService } from "./plan.service";
import { FilterQuery, Types } from 'mongoose';

export const subscriptionService = {
  /**
   * Lấy danh sách tất cả các gói cước công khai có sẵn.
   */
  async getAvailablePlans(): Promise<PlanDoc[]> {
    const plans = await PlanService.getPublicPlans();
    if (!plans || plans.length === 0) {
      throw new NotFoundError("Không tìm thấy gói cước nào.");
    }
    return plans.map(plan => ({
      ...plan.toObject(),
      id: plan._id.toString(),
    }));
  },

  async createCheckoutSession(userId: string, planSlug: string, billingPeriod: "monthly" | "yearly") {
    const [user, plan] = await Promise.all([
      UserModel.findById(userId),
      PlanService.getBySlug(planSlug)
    ]);

    if (!user) throw new NotFoundError("Không tìm thấy người dùng");
    if (!plan) throw new NotFoundError("Không tìm thấy gói cước");
    
    const currentSubscription = await SubscriptionModel.findOne({
      userId: user._id,
      status: { $in: ['active', 'trialing'] }
    });

    if (currentSubscription && currentSubscription.planSlug === planSlug) {

        const now = new Date();
        const threeDays = 3 * 24 * 60 * 60 * 1000;
        if (currentSubscription.currentPeriodEnd.getTime() - now.getTime() > threeDays) {
            throw new BadRequestError(`Bạn đang sử dụng gói ${plan.name}. Vui lòng chờ đến gần ngày hết hạn để gia hạn.`);
        }
    }
    

    const amount = billingPeriod === "monthly" ? plan.priceMonthly : plan.priceYearly;
    
    const orderId = uuidv4();
    const requestId = orderId;
    const orderInfo = `Nâng cấp tài khoản lên gói ${plan.name} (${billingPeriod === 'monthly' ? 'tháng' : 'năm'})`;

    await TransactionModel.create({
      orderId,
      user: user._id, // Model Transaction dùng field 'user'
      plan: plan._id, // Model Transaction dùng field 'plan'
      planSlug: plan.slug,
      amount,
      billingPeriod,
      paymentGateway: 'momo',
      status: 'pending',
    });
    logger.info(`[Transaction] Created pending transaction ${orderId} for user ${userId}`);

    const momoResponse = await momoService.createPaymentRequest(amount, orderInfo, orderId, requestId);
    return { payUrl: momoResponse.payUrl, deeplink: momoResponse.deeplink };
  },

  /**
   * [Admin] Lấy danh sách các GIAO DỊCH (Transactions)
   */
  async getAllTransactions(options: { page: number; limit: number; search?: string; status?: string; planId?: string; }) {
    const { page = 1, limit = 10, search, status, planId } = options;
    const skip = (page - 1) * limit;

    const query: FilterQuery<any> = {};

    if (status) query.status = status;
    if (planId && planId !== 'all') query.plan = planId;

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
      query.user = { $in: userIds };
    }

    const [transactions, total] = await Promise.all([
      TransactionModel.find(query)
        // Populate 'user' vì Frontend TransactionPage cần 'username' và 'email'
        .populate('user', 'username email name') 
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
   * [Admin] Lấy danh sách các ĐĂNG KÝ (Subscriptions)
   * SỬA LỖI: Frontend cần 'name', nhưng DB có thể chỉ có 'username'.
   */
  async getAllSubscriptions(options: { page: number; limit: number; search?: string; status?: SubscriptionDoc['status']; planId?: string; }) {
    const { page = 1, limit = 10, search, status, planId } = options;
    const skip = (page - 1) * limit;

    const query: FilterQuery<SubscriptionDoc> = { isDeleted: false };

    if (status) query.status = status;
    if (planId && planId !== 'all') query.planId = new Types.ObjectId(planId);

    if (search) {
      const users = await UserModel.find({
        $or: [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { name: { $regex: search, $options: 'i' } } // Tìm cả tên nếu có
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
        // SỬA LỖI: Populate cả 'username' và 'name' để fallback
        .populate('userId', 'username email name') 
        .populate('planId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SubscriptionModel.countDocuments(query)
    ]);

    // XỬ LÝ HẬU KỲ: Đảm bảo field 'name' luôn có dữ liệu cho Frontend
    const processedSubscriptions = subscriptions.map((sub: any) => {
      if (sub.userId) {
        // Nếu user không có field 'name', dùng 'username' thay thế
        // Frontend: sub.userId?.name
        if (!sub.userId.name) {
            sub.userId.name = sub.userId.username || sub.userId.email.split('@')[0];
        }
      }
      return sub;
    });

    const totalPages = Math.ceil(total / limit);
    return { data: processedSubscriptions, pagination: { total, page, limit, totalPages } };
  },

  async handleMomoIpn(ipnPayload: any): Promise<void> {
    logger.info(`[MoMo IPN] Received payload: ${JSON.stringify(ipnPayload, null, 2)}`);

    const isSignatureValid = momoService.verifyIpnSignature(ipnPayload);
    if (!isSignatureValid) {
      logger.error('[MoMo IPN] Invalid signature. Aborting.');
      return;
    }

    const { orderId, resultCode, message, transId } = ipnPayload;

    const transaction = await TransactionModel.findOne({ orderId });
    if (!transaction) {
      logger.error(`[MoMo IPN] Transaction ${orderId} not found.`);
      return;
    }

    if (transaction.status !== 'pending') {
      logger.warn(`[MoMo IPN] Transaction ${orderId} already processed.`);
      return;
    }

    if (resultCode === 0) { // Success
      const [user, plan] = await Promise.all([
        UserModel.findById(transaction.user),
        PlanModel.findById(transaction.plan)
      ]);

      if (!user || !plan) {
        transaction.status = 'failed';
        await transaction.save();
        return;
      }
      await SubscriptionModel.updateMany(
        {
          userId: user._id,
          status: { $in: ['active', 'trialing'] }
        },
        {
          $set: { 
            status: 'canceled', 
            canceledAt: new Date() 
          }
        }
      );
      
      logger.info(`[MoMo IPN] Canceled previous active subscriptions for user ${user._id}`);
      
      transaction.status = 'completed';
      transaction.gatewayTransactionId = transId;
      transaction.rawIpnResponse = JSON.stringify(ipnPayload);
      await transaction.save();

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
        providerSubscriptionId: `momo-${transId}`,
        status: 'active',
        billingPeriod: transaction.billingPeriod,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });

      transaction.subscriptionId = newSubscription._id as Types.ObjectId; // Cast to fix type
      await transaction.save();
      
      await UserModel.findByIdAndUpdate(user._id, {
        $set: { plan: plan.slug, remainingTokens: plan.tokenAllotment, subscriptionId: newSubscription._id }
      });

      logger.info(`[MoMo IPN] Upgrade success for user ${user.id}.`);

    } else { // Failed
      transaction.status = 'failed';
      transaction.rawIpnResponse = JSON.stringify(ipnPayload);
      await transaction.save();
      logger.info(`[MoMo IPN] Payment failed for order ${orderId}.`);
    }
  }
};