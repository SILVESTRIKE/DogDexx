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
  async submitFeedback(userId: Types.ObjectId, data: { predictionId: string; isCorrect: boolean; submittedLabel?: string; notes?: string; }) {
    const { predictionId, isCorrect, submittedLabel, notes } = data;
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