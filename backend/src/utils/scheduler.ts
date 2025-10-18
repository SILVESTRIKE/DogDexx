import cron from "node-cron";
import { usageService } from "../services/usage.service";

export const startSchedulers = () => {
  // Chạy vào 00:00 Chủ Nhật hàng tuần
  cron.schedule(
    "0 0 * * 0",
    () => {
      usageService.resetAllUsersUsage();
    },
    {
      scheduled: true,
      timezone: "Asia/Ho_Chi_Minh", 
    }
  );
  console.log(
    "✅ Scheduler đã được khởi tạo để reset giới hạn sử dụng hàng tuần."
  );
};
