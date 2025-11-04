import { PredictionHistoryModel } from '../models/prediction_history.model';
import { FeedbackModel, FeedbackDoc } from '../models/feedback.model';
import { NotFoundError, BadRequestError, NotAuthorizedError } from '../errors';
import { Types } from 'mongoose';
import { UserModel, UserDoc } from '../models/user.model';
import { sendEmail } from './email.service';

// Interface cho các bộ lọc
interface QueryFilters {
  status?: FeedbackDoc['status']
  username?: string
  submittedLabel?: string
  startDate?: string
  endDate?: string
}

export const feedbackService = {
  // --- Dành cho USER ---
  async submitFeedback(userId: Types.ObjectId, data: { predictionId: string; isCorrect: boolean; submittedLabel?: string; notes?: string; }) {
    const { predictionId, isCorrect, submittedLabel, notes } = data;

    // Yêu cầu người dùng phải đăng nhập
    if (!userId) throw new NotAuthorizedError('Bạn phải đăng nhập để gửi phản hồi.');

    const prediction = await PredictionHistoryModel.findById(predictionId);
    if (!prediction) throw new NotFoundError('Không tìm thấy lịch sử dự đoán.');

    if (prediction.user?.toString() !== userId.toString()) throw new BadRequestError('Bạn không có quyền đánh giá kết quả này.');

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
              { $group: { _id: "$user_id", total: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } }, rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } } } },
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
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    (statsResult[0]?.overallStats || []).forEach((stat: { _id: keyof typeof stats, count: number }) => {
      if (stats.hasOwnProperty(stat._id)) {
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

  /**
   * [Admin] Duyệt một feedback.
   */
  async approveFeedback(id: string): Promise<FeedbackDoc> {
    const feedback = await this.getFeedbackById(id); // Reuse getById to get populated data

    if (feedback.status !== 'pending') {
      throw new BadRequestError('Feedback này đã được xử lý.');
    }

    feedback.status = 'approved';
    await feedback.save();

    // Gửi email cảm ơn nếu có thông tin người dùng
    const user = feedback.user_id as any;
    if (user && user.email) {
      const subject = 'Cảm ơn bạn đã đóng góp cho DogBreedID!';
      const text = `Chào ${user.username},\n\nChúng tôi đã xem xét và duyệt phản hồi của bạn cho giống chó "${feedback.user_submitted_label}".\n\nSự đóng góp của bạn rất quý giá và giúp chúng tôi cải thiện độ chính xác của hệ thống. Cảm ơn bạn rất nhiều!\n\nTrân trọng,\nĐội ngũ DogBreedID`;
      
      sendEmail(user.email, subject, text).catch(err => console.error(`Không thể gửi email cảm ơn đến ${user.email}:`, err));
    }

    return feedback;
  },

  /**
   * [Admin] Từ chối một feedback.
   */
  async rejectFeedback(id: string): Promise<FeedbackDoc> {
    const feedback = await this.getFeedbackById(id);

    if (feedback.status !== 'pending') {
      throw new BadRequestError('Feedback này đã được xử lý.');
    }

    feedback.status = 'rejected';
    await feedback.save();

    return feedback;
  },
};