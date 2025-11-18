import { PredictionHistoryModel, PredictionHistoryDoc } from '../models/prediction_history.model';
import { FeedbackModel } from '../models/feedback.model';
import { ConflictError, NotAuthorizedError } from '../errors';
import { UserModel } from '../models/user.model';
import { Types, FilterQuery } from 'mongoose';

interface GetHistoryQuery {
  page?: number;
  limit?: number;
  userId?: string; // For admin filtering
  search?: string; // For admin filtering
}

export const predictionHistoryService = {
  /**
   * [User] Lấy lịch sử dự đoán của người dùng hiện tại.
   */
  async getHistoryForUser(userId: Types.ObjectId, query: GetHistoryQuery): Promise<{ histories: PredictionHistoryDoc[], total: number, page: number, limit: number, totalPages: number }> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<PredictionHistoryDoc> = { user: userId, isDeleted: false };

    const histories = await PredictionHistoryModel.find(filter)
      .populate('media')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await PredictionHistoryModel.countDocuments(filter);

    return { histories: histories as PredictionHistoryDoc[], total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / limit) };
  },

  /**
   * [User] Lấy chi tiết một lịch sử dự đoán, đảm bảo người dùng sở hữu nó.
   */
  async getHistoryByIdForUser(userId: Types.ObjectId, historyId: string): Promise<PredictionHistoryDoc> {
    const history = await PredictionHistoryModel.findOne({ _id: historyId, user: userId, isDeleted: false })
      .populate('media');

    if (!history) {
      throw new ConflictError('Không tìm thấy lịch sử dự đoán.');
    }
    return history;
  },

  /**
   * [User] Xóa mềm một lịch sử dự đoán.
   */
  async deleteHistoryForUser(userId: Types.ObjectId, historyId: string): Promise<void> {
    const result = await PredictionHistoryModel.updateOne(
      { _id: historyId, user: userId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    if (result.modifiedCount === 0) {
      throw new ConflictError('Không tìm thấy lịch sử dự đoán để xóa.');
    }
  },

  // --- Admin Functions ---

  /**
   * [Admin] Lấy tất cả lịch sử dự đoán với bộ lọc và phân trang.
   */
  async getAllHistory(query: GetHistoryQuery): Promise<{ histories: PredictionHistoryDoc[], total: number, page: number, limit: number, totalPages: number }> {
    const { page = 1, limit = 10, userId, search } = query;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<PredictionHistoryDoc> = { isDeleted: false };

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      // Tìm các user khớp với search
      const userIds = await UserModel.find({
        $or: [{ username: searchRegex }, { email: searchRegex }],
      }).select('_id');

      const userObjectIds = userIds.map(u => u._id);

      filter.$or = [
        // Lịch sử của những user được tìm thấy
        { user: { $in: userObjectIds } },
        // Hoặc lịch sử có giống chó khớp với search
        { 'predictions.class': searchRegex },
      ];
    } else if (userId) {
      // Chỉ lọc theo userId nếu không có search
      filter.user = userId;
    }

    const histories = await PredictionHistoryModel.find(filter)
      .populate('media')
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
      
    const total = await PredictionHistoryModel.countDocuments(filter);

    return { histories: histories as PredictionHistoryDoc[], total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) };
  },

  /**
   * [Admin] Lấy chi tiết bất kỳ lịch sử dự đoán nào.
   */
  async getHistoryById(historyId: string): Promise<PredictionHistoryDoc> {
    const history = await PredictionHistoryModel.findOne({ _id: historyId, isDeleted: false })
      .populate('media')
      .populate('user', 'username email');

    if (!history) {
      throw new ConflictError('Không tìm thấy lịch sử dự đoán.');
    }
    return history;
  },

  /**
   * [Admin] Duyệt lịch sử dự đoán theo cấu trúc thư mục.
   */
  async browseHistoryByPath(path: string = ''): Promise<{ directories: any[], histories: any[] }> {
    const parts = path.split('/').filter(p => p);
    const level = parts.length;

    // Level 0: Root -> List Users
    if (level === 0) {
      const users = await PredictionHistoryModel.aggregate([
        { $match: { user: { $ne: null } } },
        { $group: { _id: '$user' } },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
        { $unwind: '$userInfo' },
        { $project: { id: '$userInfo._id', name: '$userInfo.username', type: 'user' } },
        { $sort: { name: 1 } }
      ]);
      return { directories: users, histories: [] };
    }

    const userId = parts[0];
    const matchQuery: FilterQuery<PredictionHistoryDoc> = { user: new Types.ObjectId(userId) };

    // Level 1: User -> List Years
    if (level === 1) {
      const years = await PredictionHistoryModel.aggregate([
        { $match: matchQuery },
        { $group: { _id: { $year: '$createdAt' } } },
        { $project: { name: '$_id', type: 'year' } },
        { $sort: { name: -1 } }
      ]);
      return { directories: years, histories: [] };
    }

    const year = parseInt(parts[1], 10);
    matchQuery.createdAt = {
      $gte: new Date(year, 0, 1),
      $lt: new Date(year + 1, 0, 1)
    };

    // Level 2: User/Year -> List Months
    if (level === 2) {
      const months = await PredictionHistoryModel.aggregate([
        { $match: matchQuery },
        { $group: { _id: { $month: '$createdAt' } } },
        { $project: { name: '$_id', type: 'month' } },
        { $sort: { name: -1 } }
      ]);
      return { directories: months, histories: [] };
    }

    const month = parseInt(parts[2], 10);
    matchQuery.createdAt = {
      $gte: new Date(year, month - 1, 1),
      $lt: new Date(year, month, 1)
    };

    // Level 3: User/Year/Month -> List Days
    if (level === 3) {
      const days = await PredictionHistoryModel.aggregate([
        { $match: matchQuery },
        { $group: { _id: { $dayOfMonth: '$createdAt' } } },
        { $project: { name: '$_id', type: 'day' } },
        { $sort: { name: -1 } }
      ]);
      return { directories: days, histories: [] };
    }

    const day = parseInt(parts[3], 10);
    matchQuery.createdAt = {
      $gte: new Date(year, month - 1, day),
      $lt: new Date(year, month - 1, day + 1)
    };

    // Level 4: User/Year/Month/Day -> List Histories
    if (level === 4) {
      const histories = await PredictionHistoryModel.find(matchQuery)
        .populate('media')
        .populate('user', 'username email')
        .sort({ createdAt: -1 });
      return { directories: [], histories };
    }

    return { directories: [], histories: [] };
  },

  /**
   * [Admin] Xóa mềm hoặc xóa vĩnh viễn một lịch sử dự đoán.
   */
  async deleteHistory(historyId: string, hardDelete = false): Promise<void> {
    const history = await PredictionHistoryModel.findById(historyId);
    if (!history) {
      throw new ConflictError('Không tìm thấy lịch sử dự đoán để xóa.');
    }

    if (hardDelete) {
      // Xóa vĩnh viễn
      // Xóa vĩnh viễn
      // Đồng thời xóa các feedback liên quan để tránh orphaned documents
      await FeedbackModel.deleteMany({ prediction_id: history._id });
      await PredictionHistoryModel.deleteOne({ _id: historyId });
    } else {
      // Xóa mềm
      if (history.isDeleted) {
        // Nếu đã xóa mềm rồi thì không cần làm gì cả
        return;
      }
      history.isDeleted = true;
      history.updatedAt = new Date();
      await history.save();
      // Soft-delete any related feedbacks as well
      await FeedbackModel.updateMany({ prediction_id: history._id }, { $set: { isDeleted: true } });
    }
  },

  /**
   * [BFF] Tìm các media liên quan đến một giống chó.
   */
  async findHistoriesByBreedName(breedName: string, limit: number = 10): Promise<Pick<PredictionHistoryDoc, 'processedMediaPath'>[]> {
    const breedRegex = new RegExp(breedName.replace(/-/g, ' '), 'i');
    return PredictionHistoryModel.find({ 'predictions.class': { $regex: breedRegex } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('processedMediaPath')
      .lean(); // .lean() để trả về plain JS objects, nhanh hơn
  },
};
