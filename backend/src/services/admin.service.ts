import { UserModel, UserDoc } from "../models/user.model";
import {
  PredictionHistoryModel,
  PredictionHistoryDoc,
} from "../models/prediction_history.model";
import { FeedbackModel } from "../models/feedback.model";
import { MediaModel, MediaDoc } from "../models/medias.model";
import { DirectoryModel } from "../models/directory.model";
import { AnalyticsEventModel } from "../models/analytics_event.model";
import { userService } from "./user.service";
import { UserCollectionModel } from "../models/user_collection.model";
import { NotFoundError } from "../errors";
import { BrowseResult, DirectoryItem } from "../types/zod/admin.zod";
import path from "path";
import { AnalyticsEventName } from "../constants/analytics.constants";
// THÊM IMPORT
import { AppError } from "../errors";
import { PlanModel } from "../models/plan.model";
import { cloudinary } from "../config/cloudinary.config"; // <-- THÊM IMPORT CLOUDINARY
import { logger } from "../utils/logger.util";
export class AdminService {
  /**
   * Tổng hợp dữ liệu cho trang Dashboard của Admin.
   */
  //... (getDashboardData không thay đổi)
  public async getDashboardData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [stats] = await Promise.all([
      PredictionHistoryModel.aggregate([
        {
          $facet: {
            totalPredictions: [{ $count: "count" }],
            todayPredictions: [
              { $match: { createdAt: { $gte: today } } },
              { $count: "count" },
            ],
            weeklyActivity: [
              { $match: { createdAt: { $gte: sevenDaysAgo } } },
              {
                $group: {
                  _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                  },
                  predictions: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
            topBreeds: [
              { $unwind: "$predictions" },
              { $group: { _id: "$predictions.class", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 5 },
              { $project: { breed: "$_id", count: 1, _id: 0 } },
            ],
          },
        },
      ]),
    ]);

    const [totalUsers, totalFeedback, correctFeedbackCount, visitsAggregation] =
      await Promise.all([
        UserModel.countDocuments({ isDeleted: false }),
        FeedbackModel.countDocuments({ isDeleted: false }),
        FeedbackModel.countDocuments({
          status: "approved_for_training",
          isDeleted: false,
        }),
        AnalyticsEventModel.aggregate([
          {
            $match: {
              eventName: AnalyticsEventName.PAGE_VISIT,
              date: { $gte: today },
            },
          },
          { $group: { _id: null, total: { $sum: "$count" } } },
        ]),
      ]);

    const totalPredictions = stats[0]?.totalPredictions[0]?.count || 0;
    const todayPredictions = stats[0]?.todayPredictions[0]?.count || 0;
    const weeklyActivity = stats[0]?.weeklyActivity || [];
    const topBreeds = stats[0]?.topBreeds || [];
    const todayVisits = visitsAggregation[0]?.total || 0;
    const accuracy =
      totalFeedback > 0 ? (correctFeedbackCount / totalFeedback) * 100 : 0;

    const activityMap = new Map(
      weeklyActivity.map((item: { _id: string; predictions: number }) => [
        item._id,
        item.predictions,
      ])
    );
    const fullWeeklyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayString = d.toISOString().split("T")[0];
      fullWeeklyActivity.push({
        day: dayString,
        predictions: activityMap.get(dayString) || 0,
        visits: 0,
      });
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
  // ... (browseDirectory không thay đổi)
  async browseDirectory(path: string, query: any): Promise<BrowseResult> {
    const parts = path.split("/").filter(Boolean);
    const { startDate, endDate } = query;

    const dateQuery: any = {};
    if (startDate || endDate) {
      if (startDate) dateQuery.$gte = new Date(startDate);
      if (endDate) dateQuery.$lte = new Date(endDate);
    }

    if (parts.length === 0) {
      const users = await UserModel.find({ isDeleted: false })
        .select("username")
        .lean();
      const directories: DirectoryItem[] = users.map((user) => ({
        id: user.username,
        name: user.username,
        type: "folder",
      }));
      directories.push({
        id: "guest_predictions",
        name: "Guest Predictions",
        type: "folder",
      });
      directories.push({
        id: "incorrect_predictions",
        name: "incorrect_predictions",
        type: "folder",
      });
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
      if (
        parts.length === 2 &&
        (parts[1] === "images" || parts[1] === "videos")
      ) {
        const mediaType = parts[1] === "images" ? "image" : "video";
        const mediaIds = await MediaModel.find({
          creator_id: null,
          type: { $regex: `^${mediaType}/`, $options: "i" },
        }).select("_id");
        const mediaObjectIds = mediaIds.map((m) => m._id);
        const historyQuery: any = {
          user: null,
          media: { $in: mediaObjectIds },
        };
        if (Object.keys(dateQuery).length > 0)
          historyQuery.createdAt = dateQuery;
        const histories = await PredictionHistoryModel.find(historyQuery)
          .populate("media")
          .populate("feedback");
        return { directories: [], histories };
      }
    }

    if (parts[0] === "incorrect_predictions" && parts.length === 1) {
      const { breed } = query;
      let feedbackQuery: any = { isCorrect: false };
      if (breed && breed !== "all") {
        feedbackQuery.user_submitted_label = {
          $regex: `^${breed}$`,
          $options: "i",
        };
      }
      const incorrectFeedbacks = await FeedbackModel.find(
        feedbackQuery
      ).populate({
        path: "prediction_id",
        populate: [{ path: "media" }, { path: "feedback" }],
      });
      const histories = incorrectFeedbacks
        .map((fb) => fb.prediction_id)
        .filter(Boolean) as unknown as PredictionHistoryDoc[];
      return { directories: [], histories };
    }

    if (parts.length === 1) {
      const username = parts[0];
      const user = await UserModel.findOne({
        username: username,
        isDeleted: false,
      });
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
      const user = await UserModel.findOne({
        username: username,
        isDeleted: false,
      });
      if (user && (parts[1] === "images" || parts[1] === "videos")) {
        const mediaType = parts[1] === "images" ? "image" : "video";
        const mediaIds = await MediaModel.find({
          creator_id: user._id,
          type: mediaType,
        }).select("_id");
        const mediaObjectIds = mediaIds.map((m) => m._id);
        const historyQuery: any = {
          user: user._id,
          media: { $in: mediaObjectIds },
        };
        if (Object.keys(dateQuery).length > 0)
          historyQuery.createdAt = dateQuery;
        const histories = await PredictionHistoryModel.find(historyQuery)
          .populate("media")
          .populate("feedback");
        return { directories: [], histories };
      }
    }

    throw new NotFoundError(`Path not found: ${path}`);
  }

  /**
   * Duyệt hệ thống file media ảo cho trang quản lý media.
   */
  // ... (browseMediaByLogic không thay đổi)
  async browseMediaByLogic(
    path: string
  ): Promise<{ directories: DirectoryItem[]; media: MediaDoc[] }> {
    // Nếu path rỗng hoặc null, ta đang ở thư mục gốc.
    // Trong MongoDB, ta truy vấn các document không có trường parent_id hoặc parent_id là null.
    const directoryId = path ? path : null;

    logger.info(
      `[CORE_SERVICE] Duyệt thư mục thật với parent_id/directory_id: ${
        directoryId === null ? '"null" (root)' : `"${directoryId}"`
      }`
    );

    // 1. Tìm kiếm song song các thư mục con và các file media con
    const [subDirectories, mediaFiles] = await Promise.all([
      // Tìm các thư mục có parent_id là directoryId hiện tại
      DirectoryModel.find({ parent_id: directoryId, isDeleted: false })
        .sort({ name: 1 })
        .lean(),
      // Tìm các file media có directory_id là directoryId hiện tại
      MediaModel.find({ directory_id: directoryId, isDeleted: false }).sort({
        createdAt: -1,
      }),
    ]);

    logger.info(
      `[CORE_SERVICE] Kết quả từ CSDL: tìm thấy ${subDirectories.length} thư mục con, ${mediaFiles.length} media files.`
    );

    // 2. Chuyển đổi kết quả thư mục sang định dạng DirectoryItem mà frontend cần
    const directoryItems: DirectoryItem[] = subDirectories.map((dir) => ({
      // SỬA LỖI QUAN TRỌNG: Lấy _id của chính thư mục đó, KHÔNG phải creator_id
      id: dir._id.toString(),
      name: dir.name,
      type: "folder",
    }));

    // 3. Trả về cả thư mục con và file media
    return { directories: directoryItems, media: mediaFiles };
  }

  /**
   * [Admin] Xóa vĩnh viễn một media file và các bản ghi liên quan.
   */
  // ... (deleteMedia không thay đổi)
  async deleteMedia(mediaId: string): Promise<{ message: string }> {
    const media = await MediaModel.findById(mediaId);
    if (!media) throw new NotFoundError("Không tìm thấy media.");

    try {
      // Giả định mediaPath là public_id của Cloudinary (ví dụ: public/uploads/images/abc.jpg)
      const public_id =
        media.mediaPath.substring(0, media.mediaPath.lastIndexOf(".")) ||
        media.mediaPath;
      logger.info(
        `[Admin Service] Deleting Cloudinary resource for media ${mediaId}: ${public_id}`
      );
      await cloudinary.uploader.destroy(public_id);
    } catch (error: any) {
      if (error.http_code !== 404)
        logger.error(
          `Không thể xóa file trên Cloudinary: ${media.mediaPath}`,
          error.message
        );
    }

    const relatedHistories = await PredictionHistoryModel.find({
      media: media._id,
    });
    const historyIds = relatedHistories.map((h) => h._id);
    if (historyIds.length > 0) {
      await FeedbackModel.deleteMany({ prediction_id: { $in: historyIds } });
      await PredictionHistoryModel.deleteMany({ _id: { $in: historyIds } });
    }
    await media.deleteOne();
    return {
      message: `Đã xóa thành công media và ${historyIds.length} bản ghi lịch sử liên quan.`,
    };
  }

  /**
   * [Admin] Duyệt hệ thống file dataset trên Cloudinary.
   * THAY THẾ HOÀN TOÀN LOGIC CŨ DÙNG `fs`
   */
  async browseDatasetDirectory(
    relativePath: string
  ): Promise<{ directories: DirectoryItem[]; files: any[] }> {
    try {
      // Chuẩn hóa đường dẫn: loại bỏ dấu / ở đầu nếu có
      const folderPath = relativePath.startsWith("/")
        ? relativePath.substring(1)
        : relativePath;

      // Gọi API Cloudinary để lấy thư mục con và file
      const [folderResult, resourcesResult] = await Promise.all([
        cloudinary.api.sub_folders(folderPath),
        cloudinary.api.resources({
          type: "upload",
          prefix: folderPath ? `${folderPath}/` : "", // prefix phải kết thúc bằng / để chỉ tìm trong thư mục
          max_results: 500, // Tăng giới hạn nếu cần
        }),
      ]);

      // Map kết quả thư mục
      const directories: DirectoryItem[] = folderResult.folders.map(
        (folder: { name: string; path: string }) => ({
          id: folder.path,
          name: folder.name,
          type: "folder",
        })
      );

      // Map kết quả file, chỉ lấy các file trực tiếp trong thư mục hiện tại
      const files = resourcesResult.resources
        .filter((resource: { public_id: string }) => {
          // Lọc để đảm bảo file nằm trực tiếp trong thư mục, không phải trong thư mục con của nó
          const pathWithoutPrefix = resource.public_id.substring(
            folderPath.length ? folderPath.length + 1 : 0
          );
          return !pathWithoutPrefix.includes("/");
        })
        .map(
          (resource: {
            public_id: string;
            format: string;
            resource_type: string;
            bytes: number;
            created_at: string;
            secure_url: string;
          }) => ({
            id: resource.public_id,
            name:
              path.basename(resource.public_id) +
              (resource.format ? `.${resource.format}` : ""),
            type: resource.resource_type,
            size: resource.bytes,
            createdAt: resource.created_at,
            url: resource.secure_url,
          })
        );

      return { directories, files };
    } catch (error: any) {
      logger.error(
        `[Admin Service] Error browsing Cloudinary path '${relativePath}':`,
        error
      );
      if (error.http_code === 404) {
        throw new NotFoundError(
          `Directory not found on Cloudinary: ${relativePath}`
        );
      }
      throw new AppError("Failed to browse Cloudinary dataset.");
    }
  }

  async generateDatasetArchiveUrl(): Promise<string> {
    logger.info(
      '[Admin Service] Generating Cloudinary archive URL for "dataset" folder...'
    );

    const url = cloudinary.utils.download_folder("dataset", {
      expires_at: Math.floor(Date.now() / 1000) + 3600, // Unix timestamp cho 1 giờ sau
    });
    logger.info("[Admin Service] Generated signed URL for dataset archive.");
    return url;
  }

  public async getEnrichedUsers(
    options: { page?: number; limit?: number; search?: string } = {}
  ): Promise<{ pagination: any; users: any[] }> {
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
              correct: {
                $sum: { $cond: [{ $eq: ["$isCorrect", true] }, 1, 0] },
              },
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
          accuracy:
            totalPredictions > 0
              ? (correctPredictions / totalPredictions) * 100
              : 0,
        },
        status: user.verify ? "active" : "pending_verification",
      };
    });

    const enrichedUsers = await Promise.all(enrichedUsersPromises);

    // THAY ĐỔI: Lấy thông tin các gói cước để hiển thị
    const plans = await PlanModel.find({ isDeleted: false });
    const plansMap = new Map(plans.map((p) => [p.slug, p.name]));

    return {
      pagination: {
        total: usersResult.total,
        page: usersResult.page,
        limit: usersResult.limit,
        totalPages: usersResult.totalPages,
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
      {
        $match: {
          status: "pending",
          user_submitted_label: { $nin: [null, ""] },
        },
      },
      {
        $group: {
          _id: "$user_submitted_label",
          count: { $sum: 1 },
          lastReported: { $max: "$createdAt" },
        },
      },
      { $match: { count: { $gte: NEW_BREED_THRESHOLD } } },
      { $sort: { count: -1 } },
    ]);
    return potentialNewBreeds.map((item: any) => ({
      id: item._id,
      type: "new_breed_suggestion",
      message: `Giống chó '${item._id}' được đề xuất ${item.count} lần.`,
      lastReported: item.lastReported,
    }));
  }

  /**
   * Lấy dữ liệu thống kê sử dụng cho trang Usage Tracking.
   */
  public async getUsageStats() {
    const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7));

    // 1. Chạy song song: Lấy dữ liệu DB và gọi API Cloudinary
    const [users, plans, analyticsEvents, cloudinaryUsage] = await Promise.all([
      // DB Queries
      UserModel.find({ isDeleted: false })
        .select("username email plan remainingTokens createdAt")
        .lean(),
      PlanModel.find({ isDeleted: false }).lean(),
      AnalyticsEventModel.find({
        eventName: {
          $in: [
            AnalyticsEventName.SUCCESSFUL_PREDICTION,
            AnalyticsEventName.SUCCESSFUL_TRIAL,
          ],
        },
        date: { $gte: sevenDaysAgo },
      }).lean(),

      // Cloudinary API Call (Cần try-catch để tránh crash nếu Cloudinary lỗi)
      cloudinary.api.usage().catch((err) => {
        logger.error(
          "[AdminService] Failed to fetch Cloudinary usage:",
          err.message
        );
        return null;
      }),
    ]);

    // --- Xử lý dữ liệu Users & Tokens (Giữ nguyên logic cũ) ---
    const plansMap = new Map(plans.map((p) => [p.slug, p]));

    const usageData = users.map((user) => {
      const userPlan = plansMap.get(user.plan);
      return {
        userId: user._id.toString(),
        userName: user.username,
        email: user.email,
        tokensUsed: (userPlan?.tokenAllotment || 0) - user.remainingTokens,
        tokensLimit: userPlan?.tokenAllotment || 0,
        plan: userPlan?.name || user.plan,
        lastActive: user.createdAt.toISOString(),
      };
    });

    // Biểu đồ Tokens
    const tokensByDay = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      tokensByDay.set(d.toISOString().split("T")[0], 0);
    }
    analyticsEvents.forEach((event: any) => {
      const day = event.date.toISOString().split("T")[0];
      if (tokensByDay.has(day)) {
        tokensByDay.set(day, (tokensByDay.get(day) || 0) + event.count);
      }
    });
    const tokensChartData = Array.from(tokensByDay.entries())
      .map(([date, tokens]) => ({ date, tokens }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Biểu đồ Plans
    const usersByPlan = usageData.reduce((acc, user) => {
      acc[user.plan] = (acc[user.plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const plansChartData = Object.entries(usersByPlan).map(([plan, count]) => ({
      name: plan,
      count,
    }));

    // --- Xử lý dữ liệu Cloudinary (Mới) ---
        let storageStats = null;
    if (cloudinaryUsage) {
        storageStats = {
            // Lấy thông tin Credits (Quan trọng nhất cho gói Free)
            credits: {
                usage: cloudinaryUsage.credits?.usage || 0,
                limit: cloudinaryUsage.credits?.limit || 0, // Gói Free sẽ hiện 25 ở đây
                usage_percent: cloudinaryUsage.credits?.used_percent || 0
            },
            // Lấy thông tin Transformations (Số lần xử lý ảnh)
            transformations: {
                usage: cloudinaryUsage.transformations?.usage || 0,
                limit: cloudinaryUsage.transformations?.limit || 0,
                usage_percent: cloudinaryUsage.transformations?.used_percent || 0
            },
            storage: {
                used_bytes: cloudinaryUsage.storage?.usage || 0,
                limit_bytes: cloudinaryUsage.storage?.limit || 0, 
                usage_percent: cloudinaryUsage.storage?.limit > 0 
                    ? (cloudinaryUsage.storage.usage / cloudinaryUsage.storage.limit) * 100 
                    : 0
            },
            bandwidth: {
                used_bytes: cloudinaryUsage.bandwidth?.usage || 0,
                limit_bytes: cloudinaryUsage.bandwidth?.limit || 0,
                usage_percent: cloudinaryUsage.bandwidth?.limit > 0 
                    ? (cloudinaryUsage.bandwidth.usage / cloudinaryUsage.bandwidth.limit) * 100 
                    : 0
            },
            objects: {
                total_files: cloudinaryUsage.objects?.usage || 0,
                limit: cloudinaryUsage.objects?.limit || 0
            },
            plan: cloudinaryUsage.plan || 'Unknown',
            last_updated: cloudinaryUsage.last_updated 
        };
    }
    
    return {
      usageData,
      tokensChartData,
      plansChartData,
      storageStats, 
    };
  }
}
