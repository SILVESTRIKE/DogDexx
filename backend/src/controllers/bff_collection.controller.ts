// BFF Collection Controller
import { Request, Response } from 'express';

export const getPokedex = async (req: Request, res: Response) => {
  // TODO: Combine collections and wiki info
  res.status(501).json({ message: 'Not implemented' });
};

export const addBreed = async (req: Request, res: Response) => {
  // TODO: Add breed to collection, check achievements
  res.status(501).json({ message: 'Not implemented' });
};

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

export const getStats = async (req: Request, res: Response) => {
  // TODO: Get collection stats
  res.status(501).json({ message: 'Not implemented' });
};
