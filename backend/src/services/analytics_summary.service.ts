import { AnalyticsEventModel } from '../models/analytics_event.model';
import { AnalyticsSummaryModel } from '../models/analytics_summary.model';
import { logger } from '../utils/logger.util';

export class AnalyticsAggregatorService {
  /**
   * Tổng hợp dữ liệu analytics cũ (ví dụ: của tháng trước) và xóa chúng.
   */
  public static async runMonthlyRollup(): Promise<void> {
    logger.info('[AnalyticsRollup] Starting monthly analytics aggregation job...');

    // 1. Xác định khoảng thời gian cần tổng hợp (ví dụ: toàn bộ tháng trước)
    const now = new Date();
    const firstDayOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfLastMonth = new Date(firstDayOfThisMonth.getTime() - 1);
    const firstDayOfLastMonth = new Date(lastDayOfLastMonth.getFullYear(), lastDayOfLastMonth.getMonth(), 1);

    const targetYear = lastDayOfLastMonth.getFullYear();
    const targetMonth = lastDayOfLastMonth.getMonth() + 1; // getMonth() trả về 0-11

    logger.info(`[AnalyticsRollup] Aggregating data for ${targetMonth}/${targetYear}...`);

    try {
      // 2. Dùng Aggregation Pipeline để nhóm và tính tổng dữ liệu
      const aggregationPipeline = [
        // Lọc các document trong tháng trước
        {
          $match: {
            createdAt: {
              $gte: firstDayOfLastMonth,
              $lt: firstDayOfThisMonth,
            },
          },
        },
        // Nhóm theo eventName, tháng, năm và tính tổng
        {
          $group: {
            _id: {
              eventName: '$eventName',
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            totalCount: { $sum: '$count' },
          },
        },
        // Định dạng lại để phù hợp với AnalyticsSummaryModel
        {
          $project: {
            _id: 0,
            eventName: '$_id.eventName',
            year: '$_id.year',
            month: '$_id.month',
            totalCount: '$totalCount',
          },
        },
      ];

      const monthlySummaries = await AnalyticsEventModel.aggregate(aggregationPipeline);

      if (monthlySummaries.length === 0) {
        logger.info('[AnalyticsRollup] No data to aggregate for the last month.');
        return;
      }

      // 3. Dùng bulkWrite để cập nhật (upsert) vào collection summary một cách hiệu quả
      const bulkOps = monthlySummaries.map(summary => ({
        updateOne: {
          filter: { eventName: summary.eventName, year: summary.year, month: summary.month },
          update: { $inc: { totalCount: summary.totalCount } },
          upsert: true,
        },
      }));

      await AnalyticsSummaryModel.bulkWrite(bulkOps);
      logger.info(`[AnalyticsRollup] Successfully aggregated and saved ${monthlySummaries.length} summaries.`);

      // 4. (QUAN TRỌNG) Xóa dữ liệu chi tiết đã được tổng hợp
      const deleteResult = await AnalyticsEventModel.deleteMany({
        createdAt: {
          $gte: firstDayOfLastMonth,
          $lt: firstDayOfThisMonth,
        },
      });
      logger.info(`[AnalyticsRollup] Deleted ${deleteResult.deletedCount} old detailed analytics events.`);

    } catch (error) {
      logger.error('[AnalyticsRollup] Error during analytics aggregation job:', error);
    }
  }
}