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

export class AdminService {
  /**
   * Tổng hợp dữ liệu cho trang Dashboard của Admin.
   */
  public async getDashboardData() {
    // --- TỐI ƯU: Gộp các truy vấn thống kê bằng $facet ---
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
            // Đếm tổng số dự đoán
            totalPredictions: [
              { $count: "count" }
            ],
            // Đếm dự đoán hôm nay
            todayPredictions: [
              { $match: { createdAt: { $gte: today } } },
              { $count: "count" }
            ],
            // Thống kê hoạt động hàng tuần
            weeklyActivity: [
              { $match: { createdAt: { $gte: sevenDaysAgo } } },
              { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, predictions: { $sum: 1 } } },
              { $sort: { _id: 1 } }
            ],
            // Top giống chó được dự đoán
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

    // Lấy các thống kê khác từ các collection khác
    const [
        totalUsers,
        totalFeedback,
        correctFeedbackCount,
        todayVisits,
    ] = await Promise.all([
        UserModel.countDocuments({ isDeleted: false }),
        FeedbackModel.countDocuments({ isDeleted: false }),
        FeedbackModel.countDocuments({ status: 'approved_for_training', isDeleted: false }),
        AnalyticsEventModel.countDocuments({
            eventName: 'PAGE_VISIT',
            createdAt: { $gte: today },
        }),
    ]);

    // Xử lý kết quả từ $facet
    const totalPredictions = stats[0]?.totalPredictions[0]?.count || 0;
    const todayPredictions = stats[0]?.todayPredictions[0]?.count || 0;
    const weeklyActivity = stats[0]?.weeklyActivity || [];
    const topBreeds = stats[0]?.topBreeds || [];

    const accuracy =
      totalFeedback > 0 ? (correctFeedbackCount / totalFeedback) * 100 : 0;

    // Hoàn thiện dữ liệu cho biểu đồ tuần
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
        accuracyTrend: [], // Yêu cầu dữ liệu lịch sử về độ chính xác
      },
    };
  }

  /**
   * Duyệt hệ thống file ảo để quản lý media.
   */
  async browseDirectory(path: string, query: any): Promise<BrowseResult> {
    const parts = path.split("/").filter(Boolean);
    const { startDate, endDate } = query;

    // Build date range query if provided
    const dateQuery: any = {};
    if (startDate || endDate) {
      if (startDate) dateQuery.$gte = new Date(startDate);
      if (endDate) dateQuery.$lte = new Date(endDate);
    }

    if (parts.length === 0) {
      // Cấp gốc: trả về danh sách người dùng và các thư mục đặc biệt
      const users = await UserModel.find({ isDeleted: false }).select("username").lean();
      const directories: DirectoryItem[] = users.map((user) => ({
        id: user.username, // Sử dụng username làm ID
        name: user.username,
        type: "folder",
      }));

      // Thêm các thư mục đặc biệt
      directories.push({ id: "guest_predictions", name: "Guest Predictions", type: "folder" });
      directories.push({ id: "incorrect_predictions", name: "incorrect_predictions", type: "folder" });

      return { directories, histories: [] };
    }

    if (parts[0] === "guest_predictions") {
      if (parts.length === 1) {
        // Bên trong thư mục demo_user: hiển thị 'images' và 'videos'
        return {
          directories: [
            { id: "images", name: "images", type: "folder" },
            { id: "videos", name: "videos", type: "folder" },
          ],
          histories: [],
        };
      }
      if (parts.length === 2 && (parts[1] === "images" || parts[1] === "videos")) {
        // Bên trong thư mục images/videos của demo_user
        const mediaType = parts[1] === "images" ? "image" : "video"; // SỬA LỖI: mediaType phải là 'image' hoặc 'video'
        // SỬA LỖI: Sử dụng regex để tìm kiếm type (ví dụ: "image/jpeg", "image/png")
        const mediaIds = await MediaModel.find({ creator_id: null, type: { $regex: `^${mediaType}/`, $options: 'i' } }).select('_id');
        const mediaObjectIds = mediaIds.map(m => m._id); 

        // Sau đó, tìm tất cả các bản ghi lịch sử sử dụng một trong các media ID đó.
        // Populate thêm 'user' để frontend có thể hiển thị tên 'Guest'
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
          // Sử dụng regex để tìm kiếm không phân biệt hoa thường
          feedbackQuery.user_submitted_label = { $regex: `^${breed}$`, $options: 'i' };
      }

      const incorrectFeedbacks = await FeedbackModel.find(feedbackQuery).populate({
          path: 'prediction_id',
          // Populate lồng nhau để có đủ thông tin cho transformHistoryForAdmin
          populate: [{ path: 'media' }, { path: 'feedback' }] 
      });

      const histories = incorrectFeedbacks.map(fb => fb.prediction_id).filter(Boolean) as unknown as PredictionHistoryDoc[];
      return { directories: [], histories };
    }

    // --- FIX STARTS HERE ---
    // Handle browsing into a specific user's folder by username
    if (parts.length === 1) {
      const username = parts[0];
      const user = await UserModel.findOne({ username: username, isDeleted: false });
      if (user) {
        // If a user is found, show the virtual 'images' and 'videos' folders
        return {
          directories: [
            { id: "images", name: "images", type: "folder" },
            { id: "videos", name: "videos", type: "folder" },
          ],
          histories: [],
        };
      }
    }

    // Handle browsing into a user's media type folder (e.g., duong/images)
    if (parts.length === 2) {
      const username = parts[0];
      const user = await UserModel.findOne({ username: username, isDeleted: false });
      if (user && (parts[1] === "images" || parts[1] === "videos")) {
        // First, find all media of the correct type for this user
        const mediaType = parts[1] === "images" ? "image" : "video";
        const mediaIds = await MediaModel.find({ creator_id: user._id, type: mediaType }).select('_id');
        const mediaObjectIds = mediaIds.map(m => m._id); 

        // Then, find all history records that use one of those media IDs
        const historyQuery: any = { user: user._id, media: { $in: mediaObjectIds } };
        if (Object.keys(dateQuery).length > 0) historyQuery.createdAt = dateQuery;

        const histories = await PredictionHistoryModel.find(historyQuery).populate("media").populate("feedback");
        return { directories: [], histories };
      }
    }
    // --- FIX ENDS HERE ---

    throw new NotFoundError(`Path not found: ${path}`);
  }

  /**
   * Duyệt hệ thống file media ảo cho trang quản lý media.
   */
  async browseMedia(path: string): Promise<{ directories: DirectoryItem[], media: MediaDoc[] }> {
    const parts = path.split("/").filter(Boolean);

    // Cấp gốc: trả về danh sách người dùng dưới dạng thư mục
    // SỬA ĐỔI: Lấy thư mục từ DirectoryModel thay vì UserModel
    if (parts.length === 0) {
      const userDirectoriesFromDB = await DirectoryModel.find({ parent_id: null, creator_id: { $ne: null } }).populate<{ creator_id: UserDoc }>('creator_id', 'username');
      
      // Lọc ra các thư mục không phải là 'guest_uploads' để tránh trùng lặp
      const directories: DirectoryItem[] = userDirectoriesFromDB
        .filter((dir) => dir.creator_id?.username !== 'guest_uploads' && dir.name !== 'guest_uploads')
        .map((dir: any) => ({
        id: dir.creator_id?.username || dir.name, // Ưu tiên username nếu có
        name: dir.creator_id?.username || dir.name,
        type: "folder",
      }));

      // Thêm thư mục cho người dùng thử
      directories.push({ id: "guest_uploads", name: "Guest Uploads", type: "folder" });
      return { directories, media: [] };
    }

    const username = parts[0];

    // Cấp người dùng: hiển thị thư mục ảo 'images' và 'videos'
    if (parts.length === 1) {
      const isGuest = username === 'guest_uploads';
      const userExists = isGuest || (await UserModel.findOne({ username, isDeleted: false }));

      if (userExists) {
        return {
          directories: [
            { id: "images", name: "Images", type: "folder" },
            { id: "videos", name: "Videos", type: "folder" },
          ],
          media: [],
        };
      }
    }

    // Cấp media type (images/videos) của một người dùng
    if (parts.length === 2 && (parts[1] === "images" || parts[1] === "videos")) {
      const mediaType = parts[1].slice(0, -1); // 'image' or 'video'
      const user = username === 'guest_uploads' ? null : (await UserModel.findOne({ username, isDeleted: false }));

      if (user || username === 'guest_uploads') {
        const mediaFiles = await MediaModel.find({ creator_id: user?._id ?? null, type: mediaType }).sort({ createdAt: -1 });
        return { directories: [], media: mediaFiles };
      }
    }

    throw new NotFoundError(`Path not found: ${path}`);
  }

  /**
   * [Admin] Xóa vĩnh viễn một media file và các bản ghi liên quan.
   */
  async deleteMedia(mediaId: string): Promise<{ message: string }> {
    const media = await MediaModel.findById(mediaId);
    if (!media) {
      throw new NotFoundError('Không tìm thấy media.');
    }

    // 1. Xóa file vật lý
    // Giả sử media.path lưu đường dẫn tương đối từ thư mục gốc của dự án
    const filePath = path.resolve(media.mediaPath);
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      // Nếu file không tồn tại, vẫn tiếp tục xóa trong DB
      if (error.code !== 'ENOENT') {
        console.error(`Không thể xóa file vật lý: ${filePath}`, error);
        // Có thể ném lỗi ở đây nếu muốn dừng lại khi không xóa được file
      }
    }

    // 2. Tìm và xóa các PredictionHistory liên quan
    const relatedHistories = await PredictionHistoryModel.find({ media: media._id });
    const historyIds = relatedHistories.map(h => h._id);

    // 3. Xóa các Feedback liên quan đến các history đó
    if (historyIds.length > 0) {
      await FeedbackModel.deleteMany({ prediction_id: { $in: historyIds } });
      await PredictionHistoryModel.deleteMany({ _id: { $in: historyIds } });
    }

    // 4. Xóa bản ghi Media
    await media.deleteOne();

    return { message: `Đã xóa thành công media và ${historyIds.length} bản ghi lịch sử liên quan.` };
  }

  /**
   * Lấy danh sách người dùng và làm giàu dữ liệu.
   */
  public async getEnrichedUsers(options: { page?: number, limit?: number, search?: string } = {}) {
    const usersResult = await userService.getAll(options);

    // Lấy số lượng collection và prediction cho tất cả user một lần
    const [collectionCounts, predictionCounts] = await Promise.all([
      UserCollectionModel.aggregate([ // This now refers to PokedexModel
        { $project: { userId: "$user_id", count: { $size: "$collectedBreeds" } } }
      ]),
      PredictionHistoryModel.aggregate([
        { $match: { user: { $ne: null } } },
        { $group: { _id: "$user", count: { $sum: 1 } } }
      ])
    ]);

    const collectionMap = new Map(collectionCounts.map((item: any) => [item.userId.toString(), item.count]));
    const predictionMap = new Map(predictionCounts.map((item: any) => [item._id.toString(), item.count]));

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

  /**
   * Lấy dữ liệu thống kê sử dụng cho trang Usage Tracking.
   */
  public async getUsageStats() {
    const [users, detectionCounts, storageUsage, weeklyDetections] = await Promise.all([
      // Lấy tất cả người dùng
      UserModel.find({ isDeleted: false }).select('username email role createdAt').lean(),
      // Lấy số lượng dự đoán cho mỗi người dùng
      PredictionHistoryModel.aggregate([
        { $match: { user: { $ne: null } } },
        { $group: { _id: '$user', count: { $sum: 1 } } },
      ]),
      // Lấy tổng dung lượng media cho mỗi người dùng
      PredictionHistoryModel.aggregate([
        { $match: { user: { $ne: null } } },
        { $lookup: { from: 'medias', localField: 'media', foreignField: '_id', as: 'mediaInfo' } },
        { $unwind: '$mediaInfo' },
        { $group: { _id: '$user', totalSize: { $sum: '$mediaInfo.size' } } },
      ]),
      // Lấy số lượng dự đoán trong 7 ngày qua
      PredictionHistoryModel.aggregate([
        { $match: { createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) } } },
        { $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            detections: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ])
    ]);

    const detectionMap = new Map(detectionCounts.map((item) => [item._id.toString(), item.count]));
    const storageMap = new Map(storageUsage.map((item: any) => [item._id.toString(), item.totalSize]));

    const usageData = users.map((user) => {
      const userId = user._id.toString();
      const storageInGB = (storageMap.get(userId) || 0) / (1024 * 1024 * 1024);

      return {
        userId: userId,
        userName: user.username,
        email: user.email,
        detections: detectionMap.get(userId) || 0,
        storageUsed: parseFloat(storageInGB.toFixed(3)),
        storageLimit: 1, // Giả định, cần logic để lấy từ plan
        lastActive: user.createdAt.toISOString(), // Tạm thời dùng ngày tạo, cần logic last login
        plan: user.role, // Lấy plan thực tế từ role
        trend: Math.floor(Math.random() * 20) - 5, // Dữ liệu trend giả
      };
    });
    const activityMap = new Map(weeklyDetections.map((item: any) => [item._id, item.detections]));
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayString = d.toISOString().split('T')[0];
        chartData.push({ date: dayString, detections: activityMap.get(dayString) || 0 });
    }
    return { usageData, chartData };
  }
}