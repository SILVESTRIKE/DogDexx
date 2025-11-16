import { PredictionHistoryModel } from '../models/prediction_history.model';
import { FeedbackModel, FeedbackDoc } from '../models/feedback.model';
import { NotFoundError, BadRequestError, NotAuthorizedError } from '../errors';
import { Types, model } from 'mongoose';
import { UserModel, UserDoc } from '../models/user.model';
import { emailService } from './email.service';
import path from 'path';
import fs from 'fs/promises'; // Assuming these constants exist
import { MediaModel } from '../models/medias.model'; // THÊM: Import MediaModel
import { MEDIA_UPLOAD_DIR, DATASET_DIR } from '../constants/paths.constants';

import { slugify } from '../utils/slugify.util';
// Interface cho các bộ lọc
import { PREDICTION_SOURCES } from '../constants/prediction.constants';
interface QueryFilters {
  status?: FeedbackDoc['status']
  username?: string
  submittedLabel?: string
  startDate?: string
  endDate?: string
}

export const feedbackService = {
  // --- Dành cho USER ---
  async submitFeedback(userId: Types.ObjectId, data: { prediction_id: string; isCorrect: boolean; user_submitted_label?: string; notes?: string; file_path: string; }) {
    const { prediction_id, isCorrect, user_submitted_label, notes, file_path } = data;

    // Yêu cầu người dùng phải đăng nhập
    if (!userId) throw new NotAuthorizedError('Bạn phải đăng nhập để gửi phản hồi.');

    const prediction = await PredictionHistoryModel.findById(prediction_id);
    if (!prediction) throw new NotFoundError('Không tìm thấy lịch sử dự đoán.');

    if (prediction.user?.toString() !== userId.toString()) throw new BadRequestError('Bạn không có quyền đánh giá kết quả này.');

    // Kiểm tra xem feedback đã tồn tại cho prediction này chưa
    const existingFeedback = await FeedbackModel.findOne({ prediction_id });
    if (existingFeedback) {
      throw new BadRequestError('Bạn đã gửi phản hồi cho kết quả này rồi.');
    }

    let destinationPath = file_path; // Giữ lại đường dẫn cũ nếu không có hành động nào với file

    // Chỉ di chuyển hoặc sao chép file nếu file_path tồn tại
    if (file_path) {
      const fileName = path.basename(file_path);
      const sourcePath = path.resolve(process.cwd(), file_path);
      const destinationDir = path.join(DATASET_DIR, 'pending');
      destinationPath = path.join(destinationDir, fileName);
      
      try {
        await fs.access(sourcePath); // Kiểm tra file có tồn tại không
        await fs.mkdir(destinationDir, { recursive: true });

        // **LOGIC MỚI: Sao chép file từ stream, di chuyển file từ upload**
        if (prediction.source === PREDICTION_SOURCES.STREAM_CAPTURE) {
          await fs.copyFile(sourcePath, destinationPath);
          console.log(`[Feedback Service] Copied stream capture file to ${destinationPath}`);
          // Không cần cập nhật DB vì file gốc vẫn còn
        } else {
          await fs.rename(sourcePath, destinationPath);
          // SỬA LỖI: Cập nhật lại mediaPath trong MediaModel sau khi di chuyển file
          if (prediction.media) {
            const relativeDestPath = path.relative(process.cwd(), destinationPath).replace(/\\/g, '/');
            await MediaModel.updateOne({ _id: prediction.media }, { $set: { mediaPath: relativeDestPath } });
            console.log(`[Feedback Service] Moved file and updated Media entry ${prediction.media} to new path: ${relativeDestPath}`);
          }
        }
      } catch (error) {
        console.warn(`[Feedback Service] Could not process file from ${sourcePath} to ${destinationPath}. It might not exist. Error: ${(error as Error).message}`);
      }
    }

    const feedback = await FeedbackModel.create({
      prediction_id: new Types.ObjectId(prediction_id),
      user_id: userId,
      isCorrect: isCorrect,
      user_submitted_label: user_submitted_label,
      notes: notes,
      file_path: destinationPath, // Lưu đường dẫn mới của file
      status: 'pending_review',
    });

    return feedback;
  },

  // --- Dành cho ADMIN ---
  async getFeedbacks(filters: QueryFilters, pagination: { page: number; limit: number; }) {
    const { status, username, submittedLabel, startDate, endDate } = filters;
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (status) query.status = status;
    if (submittedLabel) query.user_submitted_label = { $regex: submittedLabel, $options: 'i' };

    // Lọc theo khoảng thời gian
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Lọc theo username
    if (username) {
      const users = await UserModel.find({ username: { $regex: username, $options: 'i' } }).select('_id');
      const userIds = users.map((u: UserDoc) => u._id);
      // Nếu không tìm thấy user nào, trả về mảng rỗng
      if (userIds.length === 0) return { data: [], total: 0, page, limit, totalPages: 0 };
      query.user_id = { $in: userIds };
    }

    const feedbacks = await FeedbackModel.find(query)
      .populate('user_id', 'username')
      .populate('prediction_id') // THÊM DÒNG NÀY ĐỂ LÀM GIÀU DỮ LIỆU
      .sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await FeedbackModel.countDocuments(query);

    return { data: feedbacks, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
  
  /**
   * [Admin] Lấy toàn bộ dữ liệu cho trang quản lý feedback, bao gồm danh sách, thống kê tổng quan và thống kê người dùng.
   */
  async getAdminFeedbackPageData(filters: QueryFilters, pagination: { page: number; limit: number; }) {
    // --- TỐI ƯU: Gộp các truy vấn thống kê bằng $facet ---
    const [
      feedbackResult,
      statsResult,
    ] = await Promise.all([
      // 1. Lấy danh sách feedback có phân trang
      this.getFeedbacks(filters, pagination),
  
      // 2. Gộp các truy vấn thống kê
      FeedbackModel.aggregate([
        {
          $facet: {
            // Thống kê tổng quan theo status
            overallStats: [
              { $match: { isDeleted: false } },
              { $group: { _id: "$status", count: { $sum: 1 } } }
            ],
            // Thống kê top người dùng gửi feedback
            userStats: [
              { $match: { isDeleted: false } },
              { $group: { _id: "$user_id", total: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ["$status", "approved_for_training"] }, 1, 0] } }, rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } } } },
              { $sort: { total: -1 } },
              { $limit: 10 },
              { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
              { $unwind: '$user' },
              { $project: { _id: 0, userId: '$_id', username: '$user.username', totalSubmissions: '$total', approvedCount: '$approved', rejectedCount: '$rejected' } }
            ]
          }
        }
      ])
    ]);
  
    // Định dạng lại overallStats
    const stats = {
      pending_review: 0,
      approved_for_training: 0,
      rejected: 0,
    };
    (statsResult[0]?.overallStats || []).forEach((stat: { _id: keyof typeof stats, count: number }) => {
      if (Object.prototype.hasOwnProperty.call(stats, stat._id)) {
        stats[stat._id] = stat.count;
      }
    });

    return { stats, userStats: statsResult[0]?.userStats || [], feedbacks: feedbackResult };
  },

  async getFeedbackById(id: string) {
    const feedback = await FeedbackModel.findById(id).populate({ path: 'prediction_id', populate: { path: 'media' }}).populate('user_id', 'username email');
    if (!feedback) throw new NotFoundError('Không tìm thấy feedback.');
    return feedback;
  },

  async updateFeedback(
    id: string,
    data: {
      status: FeedbackDoc['status'];
      admin_id?: Types.ObjectId;
      reason?: string;
    },
    correctedLabel?: string) {
    // TỐI ƯU: Populate prediction_id để lấy thông tin dự đoán gốc
    const feedback = await FeedbackModel.findById(id).populate('prediction_id', 'predictions');
    if (!feedback) throw new NotFoundError('Không tìm thấy feedback để cập nhật.');

    const oldStatus = feedback.status;
    feedback.status = data.status;
    if (data.admin_id) feedback.admin_id = data.admin_id;
    if (data.reason) feedback.reason = data.reason;

    // Logic di chuyển file khi trạng thái thay đổi
    if (oldStatus === 'pending_review' && (data.status === 'approved_for_training' || data.status === 'rejected')) {
      const fileName = path.basename(feedback.file_path);
      let destinationDir: string;

      // SỬA LỖI: Chuẩn hóa sourcePath.
      // Đường dẫn lưu trong DB có thể là tuyệt đối (sau khi submit) hoặc tương đối (dữ liệu cũ).
      // path.isAbsolute() sẽ kiểm tra điều này.
      const sourcePath = path.isAbsolute(feedback.file_path)
        ? feedback.file_path
        : path.resolve(process.cwd(), feedback.file_path); // Nếu là tương đối, giả định nó nằm ở gốc project

      if (data.status === 'approved_for_training') {
        // CẢI TIẾN LOGIC:
        // 1. Nếu người dùng xác nhận dự đoán là ĐÚNG (isCorrect = true), lấy tên giống chó từ dự đoán gốc.
        // 2. Nếu người dùng nói là SAI (isCorrect = false), lấy tên giống chó mà họ đã submit.
        // 3. Fallback về 'unknown' nếu không có thông tin.
        // 4. ƯU TIÊN: Nếu admin cung cấp `correctedLabel`, dùng nó.
        const prediction = feedback.prediction_id as any;
        // SỬA LỖI & CẢI TIẾN: Sử dụng slugify để tạo tên thư mục an toàn
        // CẬP NHẬT: Chuyển đổi username thành dạng slug để đảm bảo tính nhất quán
        const rawBreedName = correctedLabel && correctedLabel.trim() !== ''
          ? correctedLabel
          : feedback.isCorrect
            ? prediction?.predictions?.[0]?.class
            : feedback.user_submitted_label;
        const breedName = slugify(rawBreedName || '');
        if (!breedName) throw new Error("Không thể xác định tên giống chó để tạo thư mục. Raw name: " + rawBreedName);

        destinationDir = path.join(DATASET_DIR, 'approved', breedName);
      } else { // rejected
        destinationDir = path.join(DATASET_DIR, 'rejected');
      }
      const destinationPath = path.join(destinationDir, fileName);
      
      try {
        await fs.mkdir(destinationDir, { recursive: true });
        // **LOGIC MỚI: Sao chép file từ stream, di chuyển file từ các nguồn khác**
        // Khi duyệt feedback, file gốc đã nằm trong thư mục 'pending'.
        // Chúng ta luôn di chuyển nó từ 'pending' sang 'approved' hoặc 'rejected'.
        // Logic sao chép chỉ cần thiết ở bước submit ban đầu.
        await fs.rename(sourcePath, destinationPath);
        feedback.file_path = destinationPath; // Cập nhật đường dẫn mới
      } catch (error) {
        console.warn(`[Feedback Service] Could not move file from ${sourcePath} to ${destinationPath} during status update. Error: ${(error as Error).message}`);
        // Không cập nhật file_path nếu di chuyển thất bại
      }
    }
    await feedback.save();
    return feedback;
  },
  
  async deleteFeedback(id: string, force: boolean = false) {
    const feedback = await FeedbackModel.findById(id);
    if (!feedback) throw new NotFoundError('Không tìm thấy feedback.');

    // Logic xóa cứng
    if (force) {
      // Xóa file vật lý nếu tồn tại
      try {
        await fs.unlink(feedback.file_path);
      } catch (error: any) {
        if (error.code !== 'ENOENT') { // Ignore if file not found
          console.error(`Không thể xóa file ${feedback.file_path}:`, error);
        }
      }
      await PredictionHistoryModel.updateOne({ _id: feedback.prediction_id }, { $set: { isCorrect: null } });
      await feedback.deleteOne();
      return { message: 'Feedback đã được xóa vĩnh viễn.' };
    }
    
    // Logic xóa mềm (mặc định)
    feedback.isDeleted = true;
    await feedback.save();
    return { message: 'Feedback đã được xóa mềm.' };
  },

  /**
   * [Admin] Duyệt một feedback.
   */
  async approveFeedback(id: string, adminId: Types.ObjectId, correctedLabel?: string): Promise<FeedbackDoc> {
    const feedback = await this.getFeedbackById(id); // Reuse getById to get populated data

    if (feedback.status !== 'pending_review') {
      throw new BadRequestError('Feedback này đã được xử lý.');
    }

    // Nếu admin cung cấp label đã sửa, cập nhật nó
    if (correctedLabel && correctedLabel.trim() !== '') {
      feedback.user_submitted_label = correctedLabel.trim();
      feedback.isCorrect = false; // Coi như là "sai" so với AI, vì admin đã sửa lại
    }

    // Sử dụng updateFeedback để xử lý logic di chuyển file
    const updatedFeedback = await this.updateFeedback(id, {
      status: "approved_for_training",
      admin_id: adminId,
    },
    correctedLabel); // Truyền correctedLabel vào đây
    await updatedFeedback.populate("user_id", "username email");

    // CẬP NHẬT: Đồng bộ trạng thái isCorrect vào PredictionHistory
    await PredictionHistoryModel.updateOne(
      { _id: updatedFeedback.prediction_id },
      { $set: { isCorrect: updatedFeedback.isCorrect } }
    );

    // Gửi email cảm ơn nếu có thông tin người dùng
    const user = updatedFeedback.user_id as any;
    if (user && user.email) {
      const subject = 'Cảm ơn bạn đã đóng góp cho DogBreedID!';
      const text = `Chào ${user.username},\n\nChúng tôi đã xem xét và duyệt phản hồi của bạn cho giống chó "${updatedFeedback.user_submitted_label}".\n\nSự đóng góp của bạn rất quý giá và giúp chúng tôi cải thiện độ chính xác của hệ thống. Cảm ơn bạn rất nhiều!\n\nTrân trọng,\nĐội ngũ DogBreedID`;
      
      emailService.sendEmail(user.email, subject, text).catch(err => console.error(`Không thể gửi email cảm ơn đến ${user.email}:`, err));
    }

    return updatedFeedback;
  },

  /**
   * [Admin] Từ chối một feedback.
   */
  async rejectFeedback(id: string, adminId: Types.ObjectId, reason?: string): Promise<FeedbackDoc> {
    const feedback = await this.getFeedbackById(id);

    if (feedback.status !== 'pending_review') {
      throw new BadRequestError('Feedback này đã được xử lý.');
    }

    // Sử dụng updateFeedback để xử lý logic di chuyển file
    const updatedFeedback = await this.updateFeedback(id, {
      status: "rejected",
      admin_id: adminId,
      reason: reason,
    });
    await updatedFeedback.populate("user_id", "username email");

    // CẬP NHẬT: Đồng bộ trạng thái isCorrect vào PredictionHistory
    await PredictionHistoryModel.updateOne(
      { _id: updatedFeedback.prediction_id },
      { $set: { isCorrect: false } } // Khi từ chối, coi như dự đoán gốc là sai
    );

    return updatedFeedback;
  },
};
