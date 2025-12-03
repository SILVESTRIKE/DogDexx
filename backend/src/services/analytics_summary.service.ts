import { AnalyticsEventModel } from '../models/analytics_event.model';
import { AnalyticsSummaryModel } from '../models/analytics_summary.model';
import { logger } from '../utils/logger.util';

export class AnalyticsAggregatorService {
  public static async runMonthlyRollup(): Promise<void> {
    logger.info('[AnalyticsRollup] Starting monthly analytics aggregation job...');
    const now = new Date();
    const firstDayOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfLastMonth = new Date(firstDayOfThisMonth.getTime() - 1);
    const firstDayOfLastMonth = new Date(lastDayOfLastMonth.getFullYear(), lastDayOfLastMonth.getMonth(), 1);

    const targetYear = lastDayOfLastMonth.getFullYear();
    const targetMonth = lastDayOfLastMonth.getMonth() + 1;

    logger.info(`[AnalyticsRollup] Aggregating data for ${targetMonth}/${targetYear}...`);

    try {
      const aggregationPipeline = [
        {
          $match: {
            createdAt: {
              $gte: firstDayOfLastMonth,
              $lt: firstDayOfThisMonth,
            },
          },
        },
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

      const bulkOps = monthlySummaries.map(summary => ({
        updateOne: {
          filter: { eventName: summary.eventName, year: summary.year, month: summary.month },
          update: { $inc: { totalCount: summary.totalCount } },
          upsert: true,
        },
      }));

      await AnalyticsSummaryModel.bulkWrite(bulkOps);
      logger.info(`[AnalyticsRollup] Successfully aggregated and saved ${monthlySummaries.length} summaries.`);

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