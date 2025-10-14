import { Request, Response } from 'express';
import { getUserAchievements } from '../services/achievement.service';
import { UserCollectionModel } from '../models/user_collection.model';

export const getAchievements = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id || req.body.userId || req.query.userId;
    if (!userId) return res.status(400).json({ message: 'Missing userId' });
    const userCollections = await UserCollectionModel.find({ user_id: userId });
    const achievements = await getUserAchievements(userId, userCollections);
    res.json({ achievements });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching achievements', error: err });
  }
};
