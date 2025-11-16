import { UserModel, UserDoc } from "../models/user.model";
import { PredictionHistoryModel, PredictionHistoryDoc } from "../models/prediction_history.model";
import { FeedbackModel } from "../models/feedback.model";
import { MediaModel, MediaDoc } from "../models/medias.model";
import { DirectoryModel } from "../models/directory.model";
import { AnalyticsEventModel } from "../models/analytics_event.model";
import { userService } from "./user.service";
import { UserCollectionModel } from "../models/user_collection.model";
import { NotFoundError } from "../errors";
import {
  BrowseResult,
  DirectoryItem,
} from "../types/zod/admin.zod";
import fs from 'fs/promises';
import path from 'path';
import { AnalyticsEventName } from "../constants/analytics.constants";
// THÊM IMPORT: Cần PlanModel để lấy thông tin gói cước
import { DATASET_DIR } from '../constants/paths.constants';
import { AppError } from '../errors';
import archiver from 'archiver';
import { PlanModel } from "../models/plan.model";

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
      stats,
    ] = await Promise.all([
      PredictionHistoryModel.aggregate([
        {
          $facet: {
            totalPredictions: [{ $count: "count" }],
            todayPredictions: [{ $match: { createdAt: { $gte: today } } }, { $count: "count" }],
            weeklyActivity: [
              { $match: { createdAt: { $gte: sevenDaysAgo } } },
              { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, predictions: { $sum: 1 } } },
              { $sort: { _id: 1 } }
            ],
            topBreeds: [
              { $unwind: '$predictions' },
              { $group: { _id: '$predictions.class', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 5 },
              { $project: { breed: '$_id', count: 1, _id: 0 } }
            ]
          }
        }
      ]),
    ]);

    const [
        totalUsers,
        totalFeedback,
        correctFeedbackCount,
        visitsAggregation,
    ] = await Promise.all([
        UserModel.countDocuments({ isDeleted: false }),
        FeedbackModel.countDocuments({ isDeleted: false }),
        FeedbackModel.countDocuments({ status: 'approved_for_training', isDeleted: false }),
        AnalyticsEventModel.aggregate([
          { $match: { eventName: AnalyticsEventName.PAGE_VISIT, date: { $gte: today } } },
          { $group: { _id: null, total: { $sum: '$count' } } },
        ]),
    ]);

    const totalPredictions = stats[0]?.totalPredictions[0]?.count || 0;
    const todayPredictions = stats[0]?.todayPredictions[0]?.count || 0;
    const weeklyActivity = stats[0]?.weeklyActivity || [];
    const topBreeds = stats[0]?.topBreeds || [];
    const todayVisits = visitsAggregation[0]?.total || 0;
    const accuracy = totalFeedback > 0 ? (correctFeedbackCount / totalFeedback) * 100 : 0;

    const activityMap = new Map(weeklyActivity.map((item: { _id: string; predictions: number }) => [item._id, item.predictions]));
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
        accuracyTrend: [],
      },
    };
  }

  /**
   * Duyệt hệ thống file ảo để quản lý media.
   */
  async browseDirectory(path: string, query: any): Promise<BrowseResult> {
    const parts = path.split("/").filter(Boolean);
    const { startDate, endDate } = query;

    const dateQuery: any = {};
    if (startDate || endDate) {
      if (startDate) dateQuery.$gte = new Date(startDate);
      if (endDate) dateQuery.$lte = new Date(endDate);
    }

    if (parts.length === 0) {
      const users = await UserModel.find({ isDeleted: false }).select("username").lean();
      const directories: DirectoryItem[] = users.map((user) => ({
        id: user.username,
        name: user.username,
        type: "folder",
      }));
      directories.push({ id: "guest_predictions", name: "Guest Predictions", type: "folder" });
      directories.push({ id: "incorrect_predictions", name: "incorrect_predictions", type: "folder" });
      return { directories, histories: [] };
    }

    if (parts[0] === "guest_predictions") {
      if (parts.length === 1) {
        return {
          directories: [
            { id: "images", name: "images", type: "folder" },
            { id: "videos", name: "videos", type: "folder" },
          ],
          histories: [],
        };
      }
      if (parts.length === 2 && (parts[1] === "images" || parts[1] === "videos")) {
        const mediaType = parts[1] === "images" ? "image" : "video";
        const mediaIds = await MediaModel.find({ creator_id: null, type: { $regex: `^${mediaType}/`, $options: 'i' } }).select('_id');
        const mediaObjectIds = mediaIds.map(m => m._id); 
        const historyQuery: any = { user: null, media: { $in: mediaObjectIds } };
        if (Object.keys(dateQuery).length > 0) historyQuery.createdAt = dateQuery;
        const histories = await PredictionHistoryModel.find(historyQuery).populate("media").populate("feedback");
        return { directories: [], histories };
      }
    }

    if (parts[0] === "incorrect_predictions" && parts.length === 1) {
      const { breed } = query;
      let feedbackQuery: any = { isCorrect: false };
      if (breed && breed !== 'all') {
          feedbackQuery.user_submitted_label = { $regex: `^${breed}$`, $options: 'i' };
      }
      const incorrectFeedbacks = await FeedbackModel.find(feedbackQuery).populate({
          path: 'prediction_id',
          populate: [{ path: 'media' }, { path: 'feedback' }] 
      });
      const histories = incorrectFeedbacks.map(fb => fb.prediction_id).filter(Boolean) as unknown as PredictionHistoryDoc[];
      return { directories: [], histories };
    }

    if (parts.length === 1) {
      const username = parts[0];
      const user = await UserModel.findOne({ username: username, isDeleted: false });
      if (user) {
        return {
          directories: [
            { id: "images", name: "images", type: "folder" },
            { id: "videos", name: "videos", type: "folder" },
          ],
          histories: [],
        };
      }
    }

    if (parts.length === 2) {
      const username = parts[0];
      const user = await UserModel.findOne({ username: username, isDeleted: false });
      if (user && (parts[1] === "images" || parts[1] === "videos")) {
        const mediaType = parts[1] === "images" ? "image" : "video";
        const mediaIds = await MediaModel.find({ creator_id: user._id, type: mediaType }).select('_id');
        const mediaObjectIds = mediaIds.map(m => m._id); 
        const historyQuery: any = { user: user._id, media: { $in: mediaObjectIds } };
        if (Object.keys(dateQuery).length > 0) historyQuery.createdAt = dateQuery;
        const histories = await PredictionHistoryModel.find(historyQuery).populate("media").populate("feedback");
        return { directories: [], histories };
      }
    }

    throw new NotFoundError(`Path not found: ${path}`);
  }

  /**
   * Duyệt hệ thống file media ảo cho trang quản lý media.
   */
  async browseMediaByLogic(path: string): Promise<{ directories: DirectoryItem[], media: MediaDoc[] }> {
    // Nếu path rỗng hoặc null, ta đang ở thư mục gốc.
    // Trong MongoDB, ta truy vấn các document không có trường parent_id hoặc parent_id là null.
    const directoryId = path ? path : null;

    console.log(`[CORE_SERVICE] Duyệt thư mục thật với parent_id/directory_id: ${directoryId === null ? '"null" (root)' : `"${directoryId}"`}`);

    // 1. Tìm kiếm song song các thư mục con và các file media con
    const [subDirectories, mediaFiles] = await Promise.all([
      // Tìm các thư mục có parent_id là directoryId hiện tại
      DirectoryModel.find({ parent_id: directoryId, isDeleted: false }).sort({ name: 1 }).lean(),
      // Tìm các file media có directory_id là directoryId hiện tại
      MediaModel.find({ directory_id: directoryId, isDeleted: false }).sort({ createdAt: -1 }).lean()
    ]);

    console.log(`[CORE_SERVICE] Kết quả từ CSDL: tìm thấy ${subDirectories.length} thư mục con, ${mediaFiles.length} media files.`);

    // 2. Chuyển đổi kết quả thư mục sang định dạng DirectoryItem mà frontend cần
    const directoryItems: DirectoryItem[] = subDirectories.map(dir => ({
      // SỬA LỖI QUAN TRỌNG: Lấy _id của chính thư mục đó, KHÔNG phải creator_id
      id: dir._id.toString(),
      name: dir.name,
      type: 'folder',
    }));

    // 3. Trả về cả thư mục con và file media
    return { directories: directoryItems, media: mediaFiles };
  }

  /**
   * [Admin] Xóa vĩnh viễn một media file và các bản ghi liên quan.
   */
  async deleteMedia(mediaId: string): Promise<{ message: string }> {
    const media = await MediaModel.findById(mediaId);
    if (!media) throw new NotFoundError('Không tìm thấy media.');
    const filePath = path.resolve(media.mediaPath);
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') console.error(`Không thể xóa file vật lý: ${filePath}`, error);
    }
    const relatedHistories = await PredictionHistoryModel.find({ media: media._id });
    const historyIds = relatedHistories.map(h => h._id);
    if (historyIds.length > 0) {
      await FeedbackModel.deleteMany({ prediction_id: { $in: historyIds } });
      await PredictionHistoryModel.deleteMany({ _id: { $in: historyIds } });
    }
    await media.deleteOne();
    return { message: `Đã xóa thành công media và ${historyIds.length} bản ghi lịch sử liên quan.` };
  }

  /**
   * [Admin] Duyệt hệ thống file dataset vật lý.
   */
  async browseDatasetDirectory(relativePath: string): Promise<{ directories: DirectoryItem[], files: any[] }> {
    const safeSuffix = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
    const absolutePath = path.join(DATASET_DIR, safeSuffix);

    if (!absolutePath.startsWith(path.resolve(DATASET_DIR))) {
      throw new AppError("Access denied. Path is outside of the dataset directory.");
    }

    try {
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      const directories: DirectoryItem[] = [];
      const files: any[] = [];

      for (const entry of entries) {
        const entryPath = path.join(relativePath, entry.name);
        if (entry.isDirectory()) {
          directories.push({
            id: entryPath.replace(/\\/g, '/'), // Use normalized path as ID
            name: entry.name,
            type: 'folder',
          });
        } else {
          const stats = await fs.stat(path.join(absolutePath, entry.name));
          files.push({
            id: entryPath.replace(/\\/g, '/'),
            name: entry.name,
            type: entry.name.match(/\.(jpg|jpeg|png|gif)$/i) ? 'image' : (entry.name.match(/\.(mp4|mov|avi)$/i) ? 'video' : 'file'),
            size: stats.size,
            createdAt: stats.mtime,
            // Sửa lỗi: URL phải được phục vụ qua một route tĩnh
            url: `/public/dataset/${entryPath.replace(/\\/g, '/')}`
          });
        }
      }

      return { directories, files };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new NotFoundError(`Directory not found: ${relativePath}`);
      }
      throw error;
    }
  }

  /**
   * [Admin] Nén và trả về toàn bộ thư mục dataset.
   */
  async downloadDatasetArchive(): Promise<archiver.Archiver> {
    console.log('[Admin Service] Bắt đầu tạo file zip cho dataset...');
    const archive = archiver('zip', {
      zlib: { level: 9 } // Mức nén cao nhất
    });

    console.log(`[Admin Service] Thêm thư mục '${DATASET_DIR}' vào archive với tên 'dataset'.`);
    // Thêm toàn bộ thư mục `dataset` vào file zip với tên là `dataset`
    archive.directory(DATASET_DIR, 'dataset');

    // Quan trọng: KHÔNG gọi archive.finalize() ở đây.
    // Controller sẽ chịu trách nhiệm finalize và pipe stream.
    console.log('[Admin Service] Đã tạo đối tượng archive, trả về cho controller xử lý.');
    return archive;
  }
  /**
   * Lấy danh sách người dùng và làm giàu dữ liệu.
   */
  public async getEnrichedUsers(options: { page?: number, limit?: number, search?: string } = {}): Promise<{ pagination: any; users: any[] }> {
    const usersResult = await userService.getAll(options);

    const enrichedUsersPromises = (usersResult.data || []).map(async (user) => {
      if (!user) return null;

      const [collectionStats, predictionStats] = await Promise.all([
        UserCollectionModel.findOne({ user_id: user._id }).lean(),
        PredictionHistoryModel.aggregate([
          { $match: { user: user._id } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              correct: { $sum: { $cond: [{ $eq: ["$isCorrect", true] }, 1, 0] } },
            },
          },
        ]),
      ]);

      const totalPredictions = predictionStats[0]?.total || 0;
      const correctPredictions = predictionStats[0]?.correct || 0;

      return {
        id: user.id,
        name: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        stats: {
          predictions: totalPredictions,
          collected: collectionStats?.collectedBreeds.length || 0,
          accuracy: totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0,
        },
        status: user.verify ? "active" : "pending_verification",
      };
    });
    
    const enrichedUsers = await Promise.all(enrichedUsersPromises);

    // THAY ĐỔI: Lấy thông tin các gói cước để hiển thị
    const plans = await PlanModel.find({ isDeleted: false });
    const plansMap = new Map(plans.map(p => [p.slug, p.name]));

    
    return {
      pagination: {
        total: usersResult.total,
        page: usersResult.page,
        limit: usersResult.limit,
        totalPages: usersResult.totalPages
      },
      users: enrichedUsers, // This now contains the fully enriched user data
    };
  }

  /**
   * Lấy các cảnh báo hệ thống, ví dụ như các giống chó mới tiềm năng.
   */
  public async getSystemAlerts() {
    const NEW_BREED_THRESHOLD = 3;
    const potentialNewBreeds = await FeedbackModel.aggregate([
      { $match: { status: 'pending', user_submitted_label: { $nin: [null, ""] } } },
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

  /**
   * Lấy dữ liệu thống kê sử dụng cho trang Usage Tracking.
   */
  public async getUsageStats() {
    // THAY ĐỔI: Truy vấn các sự kiện dự đoán thành công thay vì TOKEN_SPENT
    const [users, plans, analyticsEvents] = await Promise.all([
        UserModel.find({ isDeleted: false }).select('username email plan remainingTokens createdAt').lean(),
        PlanModel.find({ isDeleted: false }).lean(),
        AnalyticsEventModel.find({ 
          eventName: { 
            $in: [AnalyticsEventName.SUCCESSFUL_PREDICTION, AnalyticsEventName.SUCCESSFUL_TRIAL] 
          }, 
          date: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) } 
        }).lean(),
    ]);

    const plansMap = new Map(plans.map(p => [p.slug, p]));

    const usageData = users.map((user) => {
      const userPlan = plansMap.get(user.plan);
      return {
        userId: user._id.toString(),
        userName: user.username,
        email: user.email,
        // Dữ liệu mới
        tokensUsed: (userPlan?.tokenAllotment || 0) - user.remainingTokens,
        tokensLimit: userPlan?.tokenAllotment || 0,
        plan: userPlan?.name || user.plan,
        // Dữ liệu cũ (có thể giữ lại nếu cần)
        lastActive: user.createdAt.toISOString(),
      };
    });

    // --- TÍNH TOÁN DỮ LIỆU CHO BIỂU ĐỒ ---

    // 1. Dữ liệu cho biểu đồ "Tokens Over Time" (Line Chart)
    const tokensByDay = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      tokensByDay.set(d.toISOString().split('T')[0], 0);
    }
    analyticsEvents.forEach((event: any) => {
        const day = event.date.toISOString().split('T')[0];
        if (tokensByDay.has(day)) {
            tokensByDay.set(day, (tokensByDay.get(day) || 0) + event.count);
        }
    });
    const tokensChartData = Array.from(tokensByDay.entries()).map(([date, tokens]) => ({ date, tokens })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 2. Dữ liệu cho biểu đồ "Users By Plan" (Bar Chart)
    const usersByPlan = usageData.reduce((acc, user) => {
        acc[user.plan] = (acc[user.plan] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const plansChartData = Object.entries(usersByPlan).map(([plan, count]) => ({ name: plan, count }));

    return { usageData, tokensChartData, plansChartData };
  }
}