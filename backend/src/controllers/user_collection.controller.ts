import { Request, Response } from 'express';
import { collectionService } from '../services/user_collections.service';

export const collectionController = {
  async getMyCollection(req: Request, res: Response) {
    const userId = req.user!._id; // Lấy từ authMiddleware
    const collection = await collectionService.getUserCollection(userId);
    res.status(200).json({ data: collection });
  }
};