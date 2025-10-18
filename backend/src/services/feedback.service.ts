import { PredictionHistoryModel } from '../models/prediction_history.model';
import { FeedbackModel, FeedbackDoc } from '../models/feedback.model';
import { NotFoundError, BadRequestError } from '../errors';
import { Types } from 'mongoose';

// Interface cho các bộ lọc
interface QueryFilters {
  status?: FeedbackDoc['status'];
  search?: string;
}

export const feedbackService = {
  // --- Dành cho USER ---
  async submitFeedback(userId: Types.ObjectId | undefined, data: { predictionId: string; isCorrect: boolean; submittedLabel?: string; notes?: string; }) {
    const { predictionId, isCorrect, submittedLabel, notes } = data;
    const prediction = await PredictionHistoryModel.findById(predictionId);

    if (!prediction) throw new NotFoundError('Không tìm thấy lịch sử dự đoán.');

    // Logic kiểm tra quyền sở hữu được cập nhật:
    // 1. Nếu là người dùng đã đăng nhập (userId tồn tại), họ phải sở hữu dự đoán.
    // 2. Nếu là người dùng thử (userId không tồn tại), dự đoán cũng phải là của người dùng thử (prediction.user không tồn tại).
    const isUserLoggedIn = !!userId;
    const isPredictionFromUser = !!prediction.user;

    if (isUserLoggedIn && prediction.user?.toString() !== userId.toString()) throw new BadRequestError('Bạn không có quyền đánh giá kết quả này.');
    if (!isUserLoggedIn && isPredictionFromUser) throw new BadRequestError('Người dùng thử không thể đánh giá kết quả của người dùng đã đăng nhập.');

    if (prediction.isCorrect !== null) throw new BadRequestError('Kết quả này đã được đánh giá.');

    prediction.isCorrect = isCorrect;
    await prediction.save();

    if (!isCorrect) {
      if (!submittedLabel) throw new BadRequestError('Vui lòng cung cấp nhãn đúng.');
      const correction = await FeedbackModel.create({
        prediction_id: prediction._id,
        user_id: userId,
        user_submitted_label: submittedLabel,
        notes: notes,
      });
      return { prediction, correction };
    }
    return { prediction };
  },

  // --- Dành cho ADMIN ---
  async getFeedbacks(filters: QueryFilters, pagination: { page: number; limit: number; }) {
    const { status, search } = filters;
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const query: any = { isDeleted: false };
    if (status) query.status = status;
    if (search) query.user_submitted_label = { $regex: search, $options: 'i' };

    const feedbacks = await FeedbackModel.find(query).populate('user_id', 'username').sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await FeedbackModel.countDocuments(query);

    return { data: feedbacks, total, page, limit, totalPages: Math.ceil(total / limit) };
  },
  
  /**
   * [Admin] Lấy toàn bộ dữ liệu cho trang quản lý feedback, bao gồm danh sách, thống kê tổng quan và thống kê người dùng.
   */
  async getAdminFeedbackPageData(filters: QueryFilters, pagination: { page: number; limit: number; }) {
    const [
      feedbackResult,
      overallStats,
      userStats,
    ] = await Promise.all([
      // 1. Lấy danh sách feedback có phân trang
      this.getFeedbacks(filters, pagination),
  
      // 2. Lấy thống kê tổng quan
      FeedbackModel.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
  
      // 3. Thống kê người dùng gửi feedback
      FeedbackModel.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: "$user_id", total: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ["$status", "approved_for_training"] }, 1, 0] } }, rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } } } },
        { $sort: { total: -1 } },
        { $limit: 10 }, // Lấy top 10 người dùng
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { _id: 0, userId: '$_id', username: '$user.username', totalSubmissions: '$total', approvedCount: '$approved', rejectedCount: '$rejected' } }
      ])
    ]);
  
    // Định dạng lại overallStats
    const stats = {
      pending_review: 0,
      approved_for_training: 0,
      rejected: 0,
    };
    overallStats.forEach((stat: { _id: keyof typeof stats, count: number }) => {
      if (stats.hasOwnProperty(stat._id)) {
        stats[stat._id] = stat.count;
      }
    });

    return { stats, userStats, feedbacks: feedbackResult };
  },

  async getFeedbackById(id: string) {
    const feedback = await FeedbackModel.findById(id).populate({ path: 'prediction_id', populate: { path: 'media' }}).populate('user_id', 'username email');
    if (!feedback) throw new NotFoundError('Không tìm thấy feedback.');
    return feedback;
  },

  async updateFeedback(id: string, data: { status?: FeedbackDoc['status']; notes?: string }) {
    const feedback = await FeedbackModel.findByIdAndUpdate(id, data, { new: true });
    if (!feedback) throw new NotFoundError('Không tìm thấy feedback để cập nhật.');
    return feedback;
  },
  
  async deleteFeedback(id: string, force: boolean = false) {
    const feedback = await FeedbackModel.findById(id);
    if (!feedback) throw new NotFoundError('Không tìm thấy feedback.');

    // Logic xóa cứng
    if (force) {
      await PredictionHistoryModel.updateOne({ _id: feedback.prediction_id }, { $set: { isCorrect: null } });
      await feedback.deleteOne();
      return { message: 'Feedback đã được xóa vĩnh viễn.' };
    }
    
    // Logic xóa mềm (mặc định)
    feedback.isDeleted = true;
    await feedback.save();
    return { message: 'Feedback đã được xóa mềm.' };
  },
};