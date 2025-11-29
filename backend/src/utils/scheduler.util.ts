import cron from "node-cron";
import { usageService } from "../services/usage.service";
import { AnalyticsAggregatorService } from "../services/analytics_summary.service";
import { subscriptionService } from "../services/subscription.service";

export const startSchedulers = () => {
  // Chạy vào 00:00 Chủ Nhật hàng tuần để reset token
  cron.schedule(
    "0 0 * * 0",
    () => {
      usageService.resetAllUsersTokens();
    },
    {
      scheduled: true,
      timezone: "Asia/Ho_Chi_Minh",
    }
  );
  // Chạy vào 01:00 ngày 1 hàng tháng để tổng hợp dữ liệu
  cron.schedule(
    "0 1 1 * *",
    () => {
      AnalyticsAggregatorService.runMonthlyRollup();
    },
    {
      scheduled: true,
      timezone: "Asia/Ho_Chi_Minh",
    }
  );

  // [MỚI] Chạy vào 00:00 hàng ngày để kiểm tra gói hết hạn
  cron.schedule(
    "0 0 * * *",
    () => {
      subscriptionService.checkExpiredSubscriptions();
    },
    {
      scheduled: true,
      timezone: "Asia/Ho_Chi_Minh",
    }
  );
};
