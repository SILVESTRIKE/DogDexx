import { Request, Response } from 'express';
import { achievementService } from '../services/achievement.service';
import { collectionService } from '../services/user_collections.service';
import { userService } from '../services/user.service';

export const getAchievements = async (req: Request, res: Response) => {
  const userId = req.user?._id || req.body.userId || req.query.userId;
  if (!userId) return res.status(400).json({ message: 'Missing userId' });

  // Lấy bộ sưu tập của người dùng trước
  const [user, userCollections] = await Promise.all([
    userService.getById(userId.toString()),
    collectionService.getUserCollection(userId)
  ]);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const achievements = await achievementService.processUserAchievements(user, userCollections); // user đã là PlainUser từ service
  res.json({ achievements });
};
