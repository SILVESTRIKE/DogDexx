// BFF Admin Controller
import { Request, Response } from 'express';
import { configService } from '../services/config.service';
import { UserModel } from '../models/user.model';
import { PredictionHistoryModel } from '../models/prediction_history.model';
import { FeedbackModel } from '../models/feedback.model';
import { feedbackService } from '../services/feedback.service';
import { userService } from '../services/user.service';
import { UserCollectionModel, UserCollectionDoc } from '../models/user_collection.model';

export const getDashboard = async (req: Request, res: Response) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    totalUsers,
    totalPredictions,
    totalFeedback,
    correctFeedbackCount,
    weeklyActivity,
    topBreeds,
  ] = await Promise.all([
    UserModel.countDocuments({ isDeleted: false }),
    PredictionHistoryModel.countDocuments({ isDeleted: false }),
    FeedbackModel.countDocuments({ isDeleted: false }),
    FeedbackModel.countDocuments({ isCorrect: true, isDeleted: false }),
    PredictionHistoryModel.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          predictions: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    PredictionHistoryModel.aggregate([
      { $unwind: "$predictions" },
      { $group: { _id: "$predictions.class", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { breed: "$_id", count: 1, _id: 0 } }
    ])
  ]);

  const accuracy = totalFeedback > 0 ? (correctFeedbackCount / totalFeedback) * 100 : 0;

  res.status(200).json({
    stats: {
      totalUsers,
      totalPredictions,
      totalFeedback,
      accuracy: parseFloat(accuracy.toFixed(2)),
      // todayVisits and todayPredictions would require a more complex analytics service
      todayVisits: 0,
      todayPredictions: 0,
    },
    charts: {
      weeklyActivity: weeklyActivity.map((item: any) => ({ day: item._id, predictions: item.predictions, visits: 0 })),
      topBreeds,
      accuracyTrend: [], // Requires historical accuracy data
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
    id: user._id,
    name: user.username,
    email: user.email,
    isAdmin: user.role === 'admin',
    createdAt: user.createdAt,
    stats: {
      predictions: predictionMap.get(user._id.toString()) || 0,
      collected: collectionMap.get(user._id.toString()) || 0,
      accuracy: 0, // Calculating per-user accuracy is expensive, can be a separate call
    },
    status: (user as any).isVerified ? 'active' : 'pending_verification',
  }));

  res.status(200).json({
    pagination: {
      total: usersResult.total, page: usersResult.page, limit: usersResult.limit, totalPages: usersResult.totalPages
    },
    users: enrichedUsers,
  });
};

export const getModelConfig = async (req: Request, res: Response) => {
  const config = await configService.getModelConfig();
  res.status(200).json({
    message: 'Lấy cấu hình model thành công.',
    data: config,
  });
};

export const updateModelConfig = async (req: Request, res: Response) => {

  const updatedConfig = await configService.updateModelConfig(req.body);  res.status(200).json({ message: 'Cập nhật cấu hình model thành công.', data: updatedConfig });
};

export const getAlerts = async (req: Request, res: Response) => {
  // Find feedbacks for new breeds that have been submitted more than N times
  const NEW_BREED_THRESHOLD = 3;

  const potentialNewBreeds = await FeedbackModel.aggregate([
    { $match: { isCorrect: false, user_submitted_label: { $nin: [null, ""] } } },
    { $group: { _id: "$user_submitted_label", count: { $sum: 1 }, lastReported: { $max: "$createdAt" } } },
    { $match: { count: { $gte: NEW_BREED_THRESHOLD } } },
    { $sort: { count: -1 } }
  ]);

  const alerts = potentialNewBreeds.map((item: any) => ({
    id: item._id, // Using breed name as ID for simplicity
    type: 'new_breed',
    severity: 'high',
    message: `Breed '${item._id}' has ${item.count} incorrect reports`,
    data: {
      breedName: item._id,
      incorrectCount: item.count,
      threshold: NEW_BREED_THRESHOLD,
    },
    createdAt: item.lastReported,
  }));

  res.status(200).json({ alerts });
};
