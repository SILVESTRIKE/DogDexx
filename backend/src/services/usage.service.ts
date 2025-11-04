import { UserModel } from "../models/user.model";
import { PlanModel } from "../models/plan.model";
import { logger } from "../utils/logger.util";

/**
 * @class usageService
 * @description Service này chứa logic liên quan đến việc sử dụng và reset tài nguyên (token) của người dùng.
 */
export const usageService = {
  /**
   * Reset số token còn lại cho tất cả người dùng về mức tối đa của gói cước họ đang sử dụng.
   * Hàm này được thiết kế để chạy định kỳ (ví dụ: hàng tuần) bởi một scheduler.
   */
  async resetAllUsersTokens(): Promise<void> {
    logger.info("[TokenResetJob] Starting weekly token reset for all users...");
    try {
      // 1. Lấy tất cả các gói cước đang hoạt động từ DB
      const plans = await PlanModel.find({ isDeleted: false });
      if (plans.length === 0) {
        logger.warn("[TokenResetJob] No active plans found. Skipping token reset.");
        return;
      }

      // 2. Tạo một Map để tra cứu token allotment của mỗi gói một cách hiệu quả
      const planTokenMap = new Map(plans.map(p => [p.slug, p.tokenAllotment]));

      // 3. Tạo các "bulk write operations" để cập nhật hàng loạt người dùng một cách hiệu quả.
      // Thay vì cập nhật từng người một, chúng ta sẽ nhóm các cập nhật theo từng gói.
      const bulkUpdatePromises = [];
      let totalUsersToUpdate = 0;

      for (const [slug, allotment] of planTokenMap.entries()) {
        const updateOperation = UserModel.updateMany(
          // Điều kiện: Tìm tất cả người dùng thuộc gói này
          { plan: slug },
          // Dữ liệu cập nhật: Đặt lại token và ngày reset
          {
            remainingTokens: allotment,
            lastUsageResetAt: new Date(),
          }
        );
        bulkUpdatePromises.push(updateOperation);
      }
      
      // 4. Thực thi tất cả các cập nhật song song
      const results = await Promise.all(bulkUpdatePromises);
      
      // 5. Ghi log kết quả
      results.forEach((result, index) => {
        if (result.modifiedCount > 0) {
          const planSlug = Array.from(planTokenMap.keys())[index];
          logger.info(`[TokenResetJob] Successfully reset tokens for ${result.modifiedCount} users on plan '${planSlug}'.`);
          totalUsersToUpdate += result.modifiedCount;
        }
      });

      logger.info(`[TokenResetJob] Finished. Total users updated: ${totalUsersToUpdate}.`);

    } catch (error) {
      logger.error("[TokenResetJob] An error occurred during the token reset job:", error);
    }
  },
};