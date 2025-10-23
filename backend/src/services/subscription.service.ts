import crypto from "crypto";
// import axios from "axios"; // Tạm thời không dùng axios
import { UserModel, UserDoc } from "../models/user.model";
import { PlanModel, PlanDoc } from "../models/plan.model";
import { NotFoundError, BadRequestError } from "../errors";
import { logger } from "../utils/logger.util";

// --- Cấu hình giả lập cho MoMo ---
// Các giá trị này sẽ được dùng khi tích hợp thật
// const MOMO_PARTNER_CODE = process.env.MOMO_PARTNER_CODE || "MOMOX";
// const MOMO_ACCESS_KEY = process.env.MOMO_ACCESS_KEY || "momo_access_key";
// const MOMO_SECRET_KEY = process.env.MOMO_SECRET_KEY || "momo_secret_key";
// const MOMO_API_ENDPOINT = process.env.MOMO_API_ENDPOINT || "https://test-payment.momo.vn/v2/gateway/api/create";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3001";
const API_URL = process.env.API_URL || "http://localhost:3000";

export const subscriptionService = {
  async createCheckoutSession(userId: string, planSlug: string, billingPeriod: "monthly" | "yearly") {
    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("Không tìm thấy người dùng");

    const plan = await PlanModel.findOne({ slug: planSlug });
    if (!plan) throw new NotFoundError("Không tìm thấy gói cước");

    if (user.plan === plan.slug) {
      throw new BadRequestError("Bạn đã đang ở gói cước này.");
    }

    const amount = billingPeriod === "monthly" ? plan.priceMonthly : plan.priceYearly;
    if (amount <= 0 && plan.slug !== 'free') {
      // Nếu là gói trả phí nhưng giá bằng 0, có thể là lỗi cấu hình
      logger.warn(`Attempting to upgrade to a paid plan '${plan.slug}' with zero cost.`);
    }

    // --- Bắt đầu phần giả lập (Simulation) ---
    // Trong môi trường dev, chúng ta sẽ bỏ qua việc gọi MoMo và nâng cấp trực tiếp
    // để dễ dàng kiểm thử luồng frontend.
    logger.info(`[SIMULATION] Upgrading user ${userId} to plan ${planSlug}`);

    // 1. Cập nhật gói cho người dùng trong DB
    user.plan = plan.slug as UserDoc["plan"];
    await user.save();

    // 2. Tạo một URL giả để chuyển hướng người dùng về trang profile
    //    với thông báo nâng cấp thành công.
    const redirectUrl = `${FRONTEND_URL}/profile?upgrade_status=success&plan=${plan.slug}`;

    // 3. Trả về URL này cho frontend
    return { payUrl: redirectUrl, deeplink: "" }; // deeplink để trống trong chế độ giả lập
  },
};