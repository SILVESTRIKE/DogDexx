import { PredictionHistoryModel, PredictionHistoryDoc } from '../models/prediction_history.model';
import { ConflictError, NotAuthorizedError } from '../errors';
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
  async getHistoryForUser(userId: Types.ObjectId, query: GetHistoryQuery): Promise<{ histories: PredictionHistoryDoc[], total: number, page: number, limit: number }> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<PredictionHistoryDoc> = { user: userId, isDeleted: false };

    const histories = await PredictionHistoryModel.find(filter)
      .populate('media')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await PredictionHistoryModel.countDocuments(filter);

    return { histories: histories as PredictionHistoryDoc[], total, page, limit };
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
  async getAllHistory(query: GetHistoryQuery): Promise<{ histories: PredictionHistoryDoc[], total: number, page: number, limit: number }> {
    const { page = 1, limit = 20, userId, search } = query;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<PredictionHistoryDoc> = { isDeleted: false };

    if (userId) {
      filter.user = userId;
    }

    if (search) {
      // Tìm kiếm theo predictedLabel, có thể mở rộng ra các trường khác
      filter.predictedLabel = { $regex: search, $options: 'i' };
    }

    const histories = await PredictionHistoryModel.find(filter)
      .populate('media')
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    const total = await PredictionHistoryModel.countDocuments(filter);

    return { histories: histories as PredictionHistoryDoc[], total, page, limit };
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
   * [Admin] Xóa mềm hoặc xóa vĩnh viễn một lịch sử dự đoán.
   */
  async deleteHistory(historyId: string, hardDelete = false): Promise<void> {
    const history = await PredictionHistoryModel.findById(historyId);
    if (!history) {
      throw new ConflictError('Không tìm thấy lịch sử dự đoán để xóa.');
    }

    if (hardDelete) {
      // Xóa vĩnh viễn
      // Cân nhắc: có nên xóa cả feedback liên quan không? Hiện tại là không.
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
