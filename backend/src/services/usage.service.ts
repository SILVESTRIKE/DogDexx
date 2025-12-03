import { UserModel } from "../models/user.model";
import { PlanModel } from "../models/plan.model";
import { logger } from "../utils/logger.util";

export const usageService = {
  async resetAllUsersTokens(): Promise<void> {
    logger.info("[TokenResetJob] Starting weekly token reset for all users...");
    try {
      const plans = await PlanModel.find({ isDeleted: false });
      if (plans.length === 0) {
        logger.warn("[TokenResetJob] No active plans found. Skipping token reset.");
        return;
      }

      const planTokenMap = new Map(plans.map(p => [p.slug, p.tokenAllotment]));

      const bulkUpdatePromises = [];
      let totalUsersToUpdate = 0;

      for (const [slug, allotment] of planTokenMap.entries()) {
        const updateOperation = UserModel.updateMany(
          { plan: slug },
          {
            remainingTokens: allotment,
            lastUsageResetAt: new Date(),
          }
        );
        bulkUpdatePromises.push(updateOperation);
      }

      const results = await Promise.all(bulkUpdatePromises);

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