import {
  PredictionHistoryModel,
  PredictionHistoryDoc,
} from "../models/prediction_history.model";
import { FeedbackModel, FeedbackDoc } from "../models/feedback.model";
import { NotFoundError, BadRequestError, NotAuthorizedError } from "../errors";
import { Types } from "mongoose";
import { UserModel, UserDoc } from "../models/user.model";
import { sendEmail } from "./email.service";
import { MediaDoc } from '../models/medias.model';

//Thêm luồng xử lý
import path from "path";
import fs from "fs-extra";

const PROJECT_ROOT = path.resolve(process.cwd());
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const DATASET_DIR = path.join(PROJECT_ROOT, "dataset");

// Interface cho các bộ lọc
interface QueryFilters {
  status?: FeedbackDoc["status"];
  username?: string;
  submittedLabel?: string;
  startDate?: string;
  endDate?: string;
}

export const feedbackService = {
  // --- Dành cho USER (REWRITTEN) ---
  async submitFeedback(
    userId: Types.ObjectId,
    data: { predictionId: string; submittedLabel: string; notes?: string }
  ) {
    // --- Phần kiểm tra ban đầu ---
    if (!userId) throw new NotAuthorizedError("Bạn phải đăng nhập để gửi phản hồi.");

    // Quan trọng: Phải populate('media') để truy cập được prediction.media.mediaUrl
    const prediction: PredictionHistoryDoc | null = await PredictionHistoryModel.findById(data.predictionId).populate('media');

    if (!prediction) throw new NotFoundError("Không tìm thấy lịch sử dự đoán.");
    if (prediction.user?.toString() !== userId.toString()) throw new BadRequestError("Bạn không có quyền đánh giá kết quả này.");

    const existingFeedback = await FeedbackModel.findOne({ prediction_id: prediction._id, isDeleted: false });
    if (existingFeedback) throw new BadRequestError("Kết quả này đã được gửi phản hồi trước đó.");

    let sourcePath: string;

    // --- LOGIC MỚI: DÙNG `media.mediaUrl` và `processedMediaPath` ---
    if (prediction.source === "image_upload" || prediction.source === "video_upload") {
        // LUỒNG UPLOAD: Lấy URL ảnh GỐC từ `prediction.media.mediaUrl`
        const mediaInfo = prediction.media as MediaDoc; // Ép kiểu để TypeScript hiểu

        if (!mediaInfo || !mediaInfo.mediaUrl) {
            throw new BadRequestError("Không tìm thấy URL media gốc trong lịch sử dự đoán.");
        }
        
        const originalUrl = new URL(mediaInfo.mediaUrl);
        const relativePath = decodeURIComponent(originalUrl.pathname);
        sourcePath = path.join(PUBLIC_DIR, relativePath.startsWith('/') ? relativePath.substring(1) : relativePath);

    } else {
        // LUỒNG STREAM: Lấy URL ảnh đã xử lý từ `prediction.processedMediaPath`
        if (!prediction.processedMediaPath) {
            throw new BadRequestError("Không tìm thấy đường dẫn media đã xử lý cho stream.");
        }
        
        const processedUrl = new URL(prediction.processedMediaPath);
        const relativePath = decodeURIComponent(processedUrl.pathname);
        sourcePath = path.join(PUBLIC_DIR, relativePath.startsWith('/') ? relativePath.substring(1) : relativePath);
    }
    
    // --- Các bước tiếp theo không đổi ---
    const fileExists = await fs.pathExists(sourcePath);
    if (!fileExists) {
      throw new BadRequestError(`Không thể tìm thấy file gốc tại: ${sourcePath}`);
    }

    const fileName = path.basename(sourcePath);
    const pendingPath = path.join(DATASET_DIR, "pending", fileName);
    
    await fs.ensureDir(path.dirname(pendingPath));
    await fs.move(sourcePath, pendingPath, { overwrite: true });

    prediction.isCorrect = false;
    await prediction.save();

    const feedback = await FeedbackModel.create({
      prediction_id: prediction._id,
      user_id: userId,
      user_submitted_label: data.submittedLabel,
      notes: data.notes,
      file_path: pendingPath, // Luôn là đường dẫn mới trong thư mục pending
      status: "pending",
    });

    return feedback;
  }

  // --- Dành cho ADMIN ---
  async getFeedbacks(
    filters: QueryFilters,
    pagination: { page: number; limit: number }
  ) {
    const { status, username, submittedLabel, startDate, endDate } = filters;
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (status) query.status = status;
    if (submittedLabel)
      query.user_submitted_label = { $regex: submittedLabel, $options: "i" };

    // Lọc theo khoảng thời gian
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Lọc theo username
    if (username) {
      const users = await UserModel.find({
        username: { $regex: username, $options: "i" },
      }).select("_id");
      const userIds = users.map((u: UserDoc) => u._id);
      // Nếu không tìm thấy user nào, trả về mảng rỗng
      if (userIds.length === 0)
        return { data: [], total: 0, page, limit, totalPages: 0 };
      query.user_id = { $in: userIds };
    }

    const feedbacks = await FeedbackModel.find(query)
      .populate("user_id", "username")
      .populate("prediction_id") // THÊM DÒNG NÀY ĐỂ LÀM GIÀU DỮ LIỆU
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await FeedbackModel.countDocuments(query);

    return {
      data: feedbacks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * [Admin] Lấy toàn bộ dữ liệu cho trang quản lý feedback, bao gồm danh sách, thống kê tổng quan và thống kê người dùng.
   */
  async getAdminFeedbackPageData(
    filters: QueryFilters,
    pagination: { page: number; limit: number }
  ) {
    // --- TỐI ƯU: Gộp các truy vấn thống kê bằng $facet ---
    const [feedbackResult, statsResult] = await Promise.all([
      // 1. Lấy danh sách feedback có phân trang
      this.getFeedbacks(filters, pagination),

      // 2. Gộp các truy vấn thống kê
      FeedbackModel.aggregate([
        {
          $facet: {
            // Thống kê tổng quan theo status
            overallStats: [
              { $match: { isDeleted: false } },
              { $group: { _id: "$status", count: { $sum: 1 } } },
            ],
            // Thống kê top người dùng gửi feedback
            userStats: [
              { $match: { isDeleted: false } },
              {
                $group: {
                  _id: "$user_id",
                  total: { $sum: 1 },
                  approved: {
                    $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
                  },
                  rejected: {
                    $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
                  },
                },
              },
              { $sort: { total: -1 } },
              { $limit: 10 },
              {
                $lookup: {
                  from: "users",
                  localField: "_id",
                  foreignField: "_id",
                  as: "user",
                },
              },
              { $unwind: "$user" },
              {
                $project: {
                  _id: 0,
                  userId: "$_id",
                  username: "$user.username",
                  totalSubmissions: "$total",
                  approvedCount: "$approved",
                  rejectedCount: "$rejected",
                },
              },
            ],
          },
        },
      ]),
    ]);

    // Định dạng lại overallStats
    const stats = {
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    (statsResult[0]?.overallStats || []).forEach(
      (stat: { _id: keyof typeof stats; count: number }) => {
        if (stats.hasOwnProperty(stat._id)) {
          stats[stat._id] = stat.count;
        }
      }
    );

    return {
      stats,
      userStats: statsResult[0]?.userStats || [],
      feedbacks: feedbackResult,
    };
  },

  async getFeedbackById(id: string) {
    const feedback = await FeedbackModel.findById(id)
      .populate({ path: "prediction_id", populate: { path: "media" } })
      .populate("user_id", "username email");
    if (!feedback) throw new NotFoundError("Không tìm thấy feedback.");
    return feedback;
  },

  async updateFeedback(
    id: string,
    data: { status?: FeedbackDoc["status"]; notes?: string }
  ) {
    const feedback = await FeedbackModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    if (!feedback)
      throw new NotFoundError("Không tìm thấy feedback để cập nhật.");
    return feedback;
  },

  async deleteFeedback(id: string, force: boolean = false) {
    const feedback = await FeedbackModel.findById(id);
    if (!feedback) throw new NotFoundError("Không tìm thấy feedback.");

    if (force) {
      // --- ADDED: Xóa file vật lý khi xóa cứng ---
      if (await fs.pathExists(feedback.file_path)) {
        await fs.remove(feedback.file_path);
      }
      await PredictionHistoryModel.updateOne(
        { _id: feedback.prediction_id },
        { $set: { isCorrect: null } }
      );
      await feedback.deleteOne();
      return { message: "Feedback đã được xóa vĩnh viễn." };
    }

    feedback.isDeleted = true;
    await feedback.save();
    return { message: "Feedback đã được xóa mềm." };
  },

  /**
   * [Admin] Duyệt một feedback.
   */
  async approveFeedback(
    id: string,
    adminId: Types.ObjectId
  ): Promise<FeedbackDoc> {
    const feedback = await this.getFeedbackById(id); // Reuse getById to get populated data

    if (feedback.status !== "pending") {
      throw new BadRequestError("Feedback này đã được xử lý.");
    }

    if (!feedback.file_path || typeof feedback.file_path !== "string") {
      console.error(
        `[CRITICAL ERROR] Feedback ID ${id} is being approved but has an invalid file_path: ${feedback.file_path}`
      );
      throw new Error(
        `Dữ liệu lỗi: Feedback với ID ${id} không có đường dẫn file hợp lệ.`
      );
    }
    if (!feedback.user_submitted_label) {
      throw new BadRequestError(
        "Không thể duyệt vì thiếu nhãn do người dùng cung cấp."
      );
    }

    // --- LOGIC DI CHUYỂN FILE KHI APPROVE ---
    const currentFileName = path.basename(feedback.file_path);
    const sourcePath = feedback.file_path; // Đường dẫn hiện tại là /dataset/pending/...
    const approvedPath = path.join(
      DATASET_DIR,
      "approved",
      feedback.user_submitted_label,
      currentFileName
    );

    // --- LOG DEBUG ---
    console.log(`[APPROVE] Current file path from DB: ${sourcePath}`);
    console.log(`[APPROVE] Destination path: ${approvedPath}`);

    const fileExists = await fs.pathExists(sourcePath);
    if (!fileExists) {
      console.error(
        `[APPROVE] CRITICAL ERROR: Source file does not exist at ${sourcePath}`
      );
      throw new Error(`File nguồn không tồn tại: ${sourcePath}`); // Ném ra lỗi rõ ràng
    }
    console.log(
      `[APPROVE] Source file confirmed to exist. Proceeding with move.`
    );

    // 1. Di chuyển file từ /pending -> /approved/{label}
    await fs.ensureDir(path.dirname(approvedPath));
    await fs.move(sourcePath, approvedPath, { overwrite: true });

    // 2. Cập nhật document
    feedback.status = "approved";
    feedback.admin_id = adminId;
    feedback.file_path = approvedPath; // Cập nhật đường dẫn file mới
    await feedback.save();

    // Gửi email cảm ơn... (giữ nguyên)
    const user = feedback.user_id as any;
    if (user && user.email) {
      const subject = "Cảm ơn bạn đã đóng góp cho DogBreedID!";
      const text = `Chào ${user.username},\n\nChúng tôi đã xem xét và duyệt phản hồi của bạn cho giống chó "${feedback.user_submitted_label}".\n\nSự đóng góp của bạn rất quý giá và giúp chúng tôi cải thiện độ chính xác của hệ thống. Cảm ơn bạn rất nhiều!\n\nTrân trọng,\nĐội ngũ DogBreedID`;
      sendEmail(user.email, subject, text).catch((err) =>
        console.error(`Không thể gửi email cảm ơn đến ${user.email}:`, err)
      );
    }

    return feedback;
  },

  /**
   * [Admin] Từ chối một feedback.
   */
  async rejectFeedback(
    id: string,
    adminId: Types.ObjectId,
    reason: string
  ): Promise<FeedbackDoc> {
    const feedback = await this.getFeedbackById(id);
    if (feedback.status !== "pending")
      throw new BadRequestError("Feedback này đã được xử lý.");

    if (!feedback.user_submitted_label) {
      throw new BadRequestError(
        "Không thể từ chối vì thiếu nhãn do người dùng cung cấp."
      );
    }

    // --- LOGIC DI CHUYỂN FILE KHI REJECT ---
    const currentFileName = path.basename(feedback.file_path);
    const sourcePath = feedback.file_path;
    const rejectedPath = path.join(
      DATASET_DIR,
      "rejected",
      feedback.user_submitted_label,
      currentFileName
    );

    // 1. Di chuyển file từ /pending -> /rejected/{label}
    await fs.ensureDir(path.dirname(rejectedPath));
    await fs.move(sourcePath, rejectedPath, { overwrite: true });

    // 2. Cập nhật document
    feedback.status = "rejected";
    feedback.admin_id = adminId;
    feedback.reason = reason;
    feedback.file_path = rejectedPath; // Cập nhật đường dẫn file mới
    await feedback.save();

    return feedback;
  },
};
