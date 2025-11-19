// src/services/feedback.service.ts

import { PredictionHistoryModel } from '../models/prediction_history.model';
import { FeedbackModel, FeedbackDoc } from '../models/feedback.model';
import { NotFoundError, BadRequestError, NotAuthorizedError } from '../errors';
import { Types } from 'mongoose';
import { UserModel, UserDoc } from '../models/user.model';
import { emailService } from './email.service';
import path from 'path';
import { MediaModel } from '../models/medias.model';
import { cloudinary } from '../config/cloudinary.config'; // Import cloudinary
import { slugify } from '../utils/slugify.util';
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
  async submitFeedback(userId: Types.ObjectId, data: { prediction_id: string; isCorrect: boolean; user_submitted_label?: string; notes?: string; file_path?: string; }) {
    const { prediction_id, isCorrect, user_submitted_label, notes } = data;

    if (!userId) throw new NotAuthorizedError('Bạn phải đăng nhập để gửi phản hồi.');

    const prediction = await PredictionHistoryModel.findById(prediction_id);
    if (!prediction) throw new NotFoundError('Không tìm thấy lịch sử dự đoán.');

    if (prediction.user?.toString() !== userId.toString()) throw new BadRequestError('Bạn không có quyền đánh giá kết quả này.');

    const existingFeedback = await FeedbackModel.findOne({ prediction_id });
    if (existingFeedback) {
      throw new BadRequestError('Bạn đã gửi phản hồi cho kết quả này rồi.');
    }

    const file_path = data.file_path || prediction.mediaPath;
    if (!file_path) throw new BadRequestError('Không tìm thấy đường dẫn file cho phản hồi này.');

    let final_file_path = file_path;

    if (prediction.source === PREDICTION_SOURCES.IMAGE_UPLOAD) {
      const from_public_id = file_path.substring(0, file_path.lastIndexOf('.')) || file_path;
      const to_public_id = `dataset/pending/${path.basename(from_public_id)}`;

      try {
        console.log(`[Feedback Service] Attempting to move Cloudinary resource from '${from_public_id}' to '${to_public_id}' and update asset_folder.`);
        
        // GIẢI PHÁP: Sử dụng uploader.rename và cập nhật asset_folder ngay sau đó.
        // Cloudinary API không cho phép đổi asset_folder và rename trong cùng một lệnh.
        const renameResult = await cloudinary.uploader.rename(from_public_id, to_public_id, { overwrite: true, invalidate: true });
        await cloudinary.uploader.explicit(renameResult.public_id, {
          type: 'upload',
          asset_folder: `dataset/pending`
        });

        final_file_path = to_public_id; 
        const fileExtension = path.extname(file_path);
        const final_file_path_with_ext = `${to_public_id}${fileExtension}`;
        console.log(`[Feedback Service] Successfully moved Cloudinary resource. New public_id: ${final_file_path}`);

        if (prediction.media) {
          await MediaModel.updateOne({ _id: prediction.media }, { $set: { mediaPath: final_file_path_with_ext } });
          console.log(`[Feedback Service] Updated Media entry ${prediction.media} to new path: ${final_file_path_with_ext}`);
        }
        await PredictionHistoryModel.updateOne({ _id: prediction._id }, { $set: { mediaPath: final_file_path_with_ext } });
        console.log(`[Feedback Service] Updated PredictionHistory entry ${prediction._id} to new path: ${final_file_path_with_ext}`);

      } catch (error) {
        console.warn(`[Feedback Service] Could not move Cloudinary resource from '${from_public_id}' to '${to_public_id}'. Error: ${(error as Error).message}`);
      }
    } else {
      console.log(`[Feedback Service] File from source '${prediction.source}' will not be moved. Path remains: ${file_path}`);
    }
    
    const predictionAfterUpdate = await PredictionHistoryModel.findById(prediction._id);
    const final_path_for_feedback = predictionAfterUpdate?.mediaPath || file_path;

    const feedback = await FeedbackModel.create({
      prediction_id: new Types.ObjectId(prediction_id),
      user_id: userId,
      isCorrect: isCorrect,
      user_submitted_label: user_submitted_label,
      notes: notes,
      file_path: final_path_for_feedback,
      status: 'pending_review',
    });

    return feedback;
  },

  // --- Dành cho ADMIN ---
  // ... (các hàm khác không thay đổi)
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
    const feedback = await FeedbackModel.findById(id).populate('prediction_id', 'predictions');
    if (!feedback) throw new NotFoundError('Không tìm thấy feedback để cập nhật.');

    const oldStatus = feedback.status;
    feedback.status = data.status;
    if (data.admin_id) feedback.admin_id = data.admin_id;
    if (data.reason) feedback.reason = data.reason;

    if (oldStatus === 'pending_review' && (data.status === 'approved_for_training' || data.status === 'rejected')) {
      const from_public_id_with_ext = feedback.file_path;
      const from_public_id = from_public_id_with_ext.substring(0, from_public_id_with_ext.lastIndexOf('.')) || from_public_id_with_ext;

      if (from_public_id && from_public_id.startsWith('dataset/pending/')) {
        const fileExtension = path.extname(from_public_id_with_ext);
        const fileName = path.basename(from_public_id);
        let to_public_id: string;

        if (data.status === 'approved_for_training') {
          const prediction = feedback.prediction_id as any;
          const rawBreedName = correctedLabel && correctedLabel.trim() !== ''
            ? correctedLabel
            : feedback.isCorrect
              ? prediction?.predictions?.[0]?.class
              : feedback.user_submitted_label;
          const breedName = slugify(rawBreedName || '');
          if (!breedName) {
            console.warn(`[Feedback Service] Could not determine breed name for feedback ${id}. Using 'unknown'. Raw name: ${rawBreedName}`);
            to_public_id = `dataset/approved/unknown/${fileName}`;
          } else {
            to_public_id = `dataset/approved/${breedName}/${fileName}`;
          }
        } else { // 'rejected'
          to_public_id = `dataset/rejected/${fileName}`;
        }

        try {
          console.log(`[Feedback Service] Attempting to move Cloudinary resource from '${from_public_id}' to '${to_public_id}' and update asset_folder.`);
          
          // GIẢI PHÁP: Tương tự như trên, rename rồi explicit để cập nhật asset_folder.
          const renameResult = await cloudinary.uploader.rename(from_public_id, to_public_id, { overwrite: true, invalidate: true });
          const newAssetFolder = to_public_id.split('/').slice(0, -1).join('/'); // e.g., "dataset/approved/poodle"

          await cloudinary.uploader.explicit(renameResult.public_id, {
            type: 'upload',
            asset_folder: newAssetFolder
          });
          
          feedback.file_path = `${to_public_id}${fileExtension}`;
          console.log(`[Feedback Service] Successfully moved Cloudinary resource for feedback ${id}. New public_id: ${to_public_id}`);
        } catch (error) {
          console.warn(`[Feedback Service] Could not move Cloudinary resource from '${from_public_id}' to '${to_public_id}' during status update. Error: ${(error as Error).message}`);
        }
      } else {
        console.log(`[Feedback Service] File for feedback ${id} is not in 'dataset/pending/' or has no path. Skipping move. Path: ${from_public_id}`);
      }
    }
    await feedback.save();
    return feedback;
  },
  
  // ... (các hàm còn lại không đổi)
  async deleteFeedback(id: string, force: boolean = false) {
    const feedback = await FeedbackModel.findById(id);
    if (!feedback) throw new NotFoundError('Không tìm thấy feedback.');

    // Logic xóa cứng
    if (force) {
      // Xóa file trên Cloudinary nếu tồn tại
      try {
        if (feedback.file_path && feedback.file_path.startsWith('dataset/')) {
          const public_id = feedback.file_path.substring(0, feedback.file_path.lastIndexOf('.')) || feedback.file_path;
          console.log(`[Feedback Service] Deleting Cloudinary resource: ${public_id}`);
          await cloudinary.uploader.destroy(public_id);
        }
      } catch (error: any) {
        if (error.http_code !== 404) { // Ignore if not found
          console.error(`Không thể xóa file trên Cloudinary ${feedback.file_path}:`, error.message);
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
    // SỬA LỖI: `updatedFeedback.prediction_id` là một object đã được populate,
    // cần phải truy cập vào trường `_id` của nó để thực hiện query.
    const predictionId = (updatedFeedback.prediction_id as any)._id;
    await PredictionHistoryModel.updateOne(
      { _id: predictionId },
      { $set: { isCorrect: false } }
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
    // SỬA LỖI: Tương tự như approve, `updatedFeedback.prediction_id` là một object đã được populate.
    const predictionId = (updatedFeedback.prediction_id as any)._id;
    await PredictionHistoryModel.updateOne(
      { _id: predictionId },
      { $set: { isCorrect: true } } // Khi từ chối, coi như dự đoán gốc là đúng
    );

    return updatedFeedback;
  },
};