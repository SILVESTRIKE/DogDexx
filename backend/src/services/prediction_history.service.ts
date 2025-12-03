import { PredictionHistoryModel, PredictionHistoryDoc } from '../models/prediction_history.model';
import { FeedbackModel } from '../models/feedback.model';
import { ConflictError, NotAuthorizedError } from '../errors';
import { UserModel } from '../models/user.model';
import { Types, FilterQuery } from 'mongoose';

interface GetHistoryQuery {
  page?: number;
  limit?: number;
  userId?: string;
  search?: string;
}

export const predictionHistoryService = {
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

  async getHistoryByIdForUser(userId: Types.ObjectId, historyId: string): Promise<PredictionHistoryDoc> {
    const history = await PredictionHistoryModel.findOne({ _id: historyId, user: userId, isDeleted: false })
      .populate('media');

    if (!history) {
      throw new ConflictError('Không tìm thấy lịch sử dự đoán.');
    }
    return history;
  },

  async deleteHistoryForUser(userId: Types.ObjectId, historyId: string): Promise<void> {
    const result = await PredictionHistoryModel.updateOne(
      { _id: historyId, user: userId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    if (result.modifiedCount === 0) {
      throw new ConflictError('Không tìm thấy lịch sử dự đoán để xóa.');
    }
  },

  async getAllHistory(query: GetHistoryQuery): Promise<{ histories: PredictionHistoryDoc[], total: number, page: number, limit: number, totalPages: number }> {
    const { page = 1, limit = 10, userId, search } = query;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<PredictionHistoryDoc> = { isDeleted: false };

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const userIds = await UserModel.find({
        $or: [{ username: searchRegex }, { email: searchRegex }],
      }).select('_id');

      const userObjectIds = userIds.map(u => u._id);

      filter.$or = [
        { user: { $in: userObjectIds } },
        { 'predictions.class': searchRegex },
      ];
    } else if (userId) {
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

  async getHistoryById(historyId: string): Promise<PredictionHistoryDoc> {
    const history = await PredictionHistoryModel.findOne({ _id: historyId, isDeleted: false })
      .populate('media')
      .populate('user', 'username email');

    if (!history) {
      throw new ConflictError('Không tìm thấy lịch sử dự đoán.');
    }
    return history;
  },

  async browseHistoryByPath(path: string = ''): Promise<{ directories: any[], histories: any[] }> {
    const parts = path.split('/').filter(p => p);
    const level = parts.length;

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

    if (level === 4) {
      const histories = await PredictionHistoryModel.find(matchQuery)
        .populate('media')
        .populate('user', 'username email')
        .sort({ createdAt: -1 });
      return { directories: [], histories };
    }

    return { directories: [], histories: [] };
  },

  async deleteHistory(historyId: string, hardDelete = false): Promise<void> {
    const history = await PredictionHistoryModel.findById(historyId);
    if (!history) {
      throw new ConflictError('Không tìm thấy lịch sử dự đoán để xóa.');
    }

    if (hardDelete) {
      await FeedbackModel.deleteMany({ prediction_id: history._id });
      await PredictionHistoryModel.deleteOne({ _id: historyId });
    } else {
      if (history.isDeleted) {
        return;
      }
      history.isDeleted = true;
      history.updatedAt = new Date();
      await history.save();
      await FeedbackModel.updateMany({ prediction_id: history._id }, { $set: { isDeleted: true } });
    }
  },

  async findHistoriesByBreedName(breedName: string, limit: number = 10): Promise<Pick<PredictionHistoryDoc, 'processedMediaPath'>[]> {
    const breedRegex = new RegExp(breedName.replace(/-/g, ' '), 'i');
    return PredictionHistoryModel.find({ 'predictions.class': { $regex: breedRegex } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('processedMediaPath')
      .lean();
  },
};
