// BFF Admin Controller
import { Request, Response } from 'express';
import { configService } from '../services/config.service';
<<<<<<< Updated upstream

export const getDashboard = async (req: Request, res: Response) => {
  // TODO: Aggregate analytics for dashboard
  res.status(501).json({ message: 'Not implemented' });
};

export const getFeedback = async (req: Request, res: Response) => {
  // TODO: Combine feedback, user info, prediction details, breed info
  res.status(501).json({ message: 'Not implemented' });
};

export const getUsers = async (req: Request, res: Response) => {
  // TODO: Get users, enrich with collection stats and prediction history
  res.status(501).json({ message: 'Not implemented' });
};

export const getModelConfig = async (req: Request, res: Response) => {
  const config = await configService.getModelConfig();
  res.status(200).json({
=======
import { UserModel } from '../models/user.model';
import { PredictionHistoryModel } from '../models/prediction_history.model';
import { FeedbackModel } from '../models/feedback.model';
import { feedbackService } from '../services/feedback.service';
import { userService } from '../services/user.service';
import { UserCollectionModel, UserCollectionDoc } from '../models/user_collection.model';

export const getDashboard = async (req: Request, res: Response) => {
  const [
    totalUsers,
    totalPredictions,
    pendingFeedbacks,
    recentUsers,
    recentPredictions,
  ] = await Promise.all([
    UserModel.countDocuments({ isDeleted: false }),
    PredictionHistoryModel.countDocuments({ isDeleted: false }),
    FeedbackModel.countDocuments({ status: 'pending_review', isDeleted: false }),
    UserModel.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(5).select('username email createdAt'),
    PredictionHistoryModel.find({ isDeleted: false }).sort({ createdAt: -1 }).limit(5).populate('user', 'username'),
  ]);

  res.status(200).json({
    message: "Lấy dữ liệu dashboard thành công.",
    data: {
      stats: {
        totalUsers,
        totalPredictions,
        pendingFeedbacks,
      },
      recentUsers,
      recentPredictions,
    }
  });
};

export const getFeedback = async (req: Request, res: Response) => {
  // The core feedback service already populates the necessary data.
  // We can enrich it further if needed, but for now, it's sufficient.
  const { getFeedbacks } = require('./feedback.controller');
  return getFeedbacks(req, res);
};

export const getUsers = async (req: Request, res: Response) => {
  const options = {
    page: parseInt(req.query.page as string, 10) || 1,
    limit: parseInt(req.query.limit as string, 10) || 10,
    search: req.query.search as string | undefined,
  };
  const usersResult = await userService.getAll(options);

  // Use aggregation for better performance
  const collectionCounts = await UserCollectionModel.aggregate([
    { $group: { _id: "$user_id", count: { $sum: 1 } } }
  ]);
  const predictionCounts = await PredictionHistoryModel.aggregate([
    { $match: { user: { $ne: null } } },
    { $group: { _id: "$user", count: { $sum: 1 } } }
  ]);

  const collectionMap = new Map(collectionCounts.map(item => [item._id.toString(), item.count]));
  const predictionMap = new Map(predictionCounts.map(item => [item._id.toString(), item.count]));

  const enrichedUsers = usersResult.data.map(user => ({
    ...user, // user is already a plain object from the service
    collectionCount: collectionMap.get(user._id.toString()) || 0,
    predictionCount: predictionMap.get(user._id.toString()) || 0,
  }));

  res.status(200).json({
    message: "Lấy danh sách người dùng thành công.",
    data: {
      ...usersResult,
      data: enrichedUsers,
    }
  });
};

export const getModelConfig = async (req: Request, res: Response) => {
  const config = await configService.getModelConfig();  res.status(200).json({
>>>>>>> Stashed changes
    message: 'Lấy cấu hình model thành công.',
    data: config,
  });
};

export const updateModelConfig = async (req: Request, res: Response) => {
<<<<<<< Updated upstream
  const updatedConfig = await configService.updateModelConfig(req.body);
  res.status(200).json({ message: 'Cập nhật cấu hình model thành công.', data: updatedConfig });
};

export const getAlerts = async (req: Request, res: Response) => {
  // TODO: Aggregate alerts
  res.status(501).json({ message: 'Not implemented' });
=======
  const updatedConfig = await configService.updateModelConfig(req.body);  res.status(200).json({ message: 'Cập nhật cấu hình model thành công.', data: updatedConfig });
};

export const getAlerts = async (req: Request, res: Response) => {
  // Find feedbacks for new breeds that have been submitted more than N times
  const NEW_BREED_THRESHOLD = 3;

  const potentialNewBreeds = await FeedbackModel.aggregate([
    { $match: { status: 'pending_review', isDeleted: false } },
    { $group: { _id: "$user_submitted_label", count: { $sum: 1 } } },
    { $match: { count: { $gte: NEW_BREED_THRESHOLD } } },
    { $sort: { count: -1 } }
  ]);

  res.status(200).json({ message: "Lấy cảnh báo thành công.", data: potentialNewBreeds });
>>>>>>> Stashed changes
};
