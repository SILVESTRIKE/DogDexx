import { UserModel } from '../models/user.model';
import { PredictionHistoryModel } from '../models/prediction_history.model';
import { FeedbackModel } from '../models/feedback.model';
import { AnalyticsEventModel } from '../models/analytics_event.model';
import { userService } from './user.service';
import { UserCollectionModel } from '../models/user_collection.model';
import { UserDoc } from '../models/user.model';

export class AdminService {
  /**
   * Tổng hợp dữ liệu cho trang Dashboard của Admin.
   */
  public async getDashboardData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalUsers,
      totalPredictions,
      totalFeedback,
      correctFeedbackCount,
      weeklyActivity,
      topBreeds,
      todayPredictions,
      todayVisits,
    ] = await Promise.all([
      UserModel.countDocuments({ isDeleted: false }),
      PredictionHistoryModel.countDocuments({ isDeleted: false }),
      FeedbackModel.countDocuments({ isDeleted: false }),
      FeedbackModel.countDocuments({ isCorrect: true, isDeleted: false }),
      PredictionHistoryModel.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            predictions: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      PredictionHistoryModel.aggregate([
        { $unwind: '$predictions' },
        { $group: { _id: '$predictions.class', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $project: { breed: '$_id', count: 1, _id: 0 } },
      ]),
      PredictionHistoryModel.countDocuments({ createdAt: { $gte: today } }),
      AnalyticsEventModel.countDocuments({
        eventName: 'PAGE_VISIT',
        createdAt: { $gte: today },
      }),
    ]);

    const accuracy =
      totalFeedback > 0 ? (correctFeedbackCount / totalFeedback) * 100 : 0;

    // Hoàn thiện dữ liệu cho biểu đồ tuần
    const activityMap = new Map(weeklyActivity.map(item => [item._id, item.predictions]));
    const fullWeeklyActivity = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayString = d.toISOString().split('T')[0];
        fullWeeklyActivity.push({ day: dayString, predictions: activityMap.get(dayString) || 0, visits: 0 });
    }

    return {
      stats: {
        totalUsers,
        totalPredictions,
        totalFeedback,
        accuracy: parseFloat(accuracy.toFixed(2)),
        todayVisits: todayVisits,
        todayPredictions,
      },
      charts: {
        weeklyActivity: fullWeeklyActivity,
        topBreeds,
        accuracyTrend: [], // Yêu cầu dữ liệu lịch sử về độ chính xác
      },
    };
  }

  /**
   * Lấy danh sách người dùng và làm giàu dữ liệu.
   */
  public async getEnrichedUsers(options: { page?: number, limit?: number, search?: string } = {}) {
    const usersResult = await userService.getAll(options);

    // Lấy số lượng collection và prediction cho tất cả user một lần
    const [collectionCounts, predictionCounts] = await Promise.all([
      UserCollectionModel.aggregate([
        { $group: { _id: "$user_id", count: { $sum: 1 } } }
      ]),
      PredictionHistoryModel.aggregate([
        { $match: { user: { $ne: null } } },
        { $group: { _id: "$user", count: { $sum: 1 } } }
      ])
    ]);

    const collectionMap = new Map(collectionCounts.map(item => [item._id.toString(), item.count]));
    const predictionMap = new Map(predictionCounts.map(item => [item._id.toString(), item.count]));

    const enrichedUsers = usersResult.data.map(user => ({
      id: user._id,
      name: user.username,
      email: user.email,
      role: (user as UserDoc).role,
      createdAt: user.createdAt,
      stats: {
        predictions: predictionMap.get(user._id.toString()) || 0,
        collected: collectionMap.get(user._id.toString()) || 0,
        accuracy: 0, // Tính toán độ chính xác cho mỗi user khá tốn kém, có thể là một API riêng
      },
      status: (user as UserDoc).verify ? 'active' : 'pending_verification',
    }));

    return {
      pagination: {
        total: usersResult.total, page: usersResult.page, limit: usersResult.limit, totalPages: usersResult.totalPages
      },
      users: enrichedUsers,
    };
  }

  /**
   * Lấy các cảnh báo hệ thống, ví dụ như các giống chó mới tiềm năng.
   */
  public async getSystemAlerts() {
    const NEW_BREED_THRESHOLD = 3;

    const potentialNewBreeds = await FeedbackModel.aggregate([
      { $match: { status: 'pending_review', user_submitted_label: { $nin: [null, ""] } } },
      { $group: { _id: "$user_submitted_label", count: { $sum: 1 }, lastReported: { $max: "$createdAt" } } },
      { $match: { count: { $gte: NEW_BREED_THRESHOLD } } },
      { $sort: { count: -1 } }
    ]);

    return potentialNewBreeds.map((item: any) => ({
      id: item._id,
      type: 'new_breed_suggestion',
      message: `Giống chó '${item._id}' được đề xuất ${item.count} lần.`,
      lastReported: item.lastReported,
    }));
  }
}