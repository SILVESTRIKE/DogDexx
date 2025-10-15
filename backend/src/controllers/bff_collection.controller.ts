import { Request, Response } from 'express';
import { wikiService } from '../services/dogs_wiki.service';
import { collectionService } from '../services/user_collections.service';
import { Types } from 'mongoose';
import { achievementService } from '../services/achievement.service';
import { UserCollectionModel } from '../models/user_collection.model';
import { DogBreedWikiModel } from '../models/dogs_wiki.model';

export const getPokedex = async (req: Request, res: Response) => {
  const userId = req.user?._id;

  // 1. Lấy các tham số query để lọc và phân trang
  const { page = 1, limit = 20, search, group, energy_level, trainability, shedding_level, suitable_for, sort } = req.query;
  const options = { page: Number(page), limit: Number(limit), search, group, energy_level: Number(energy_level) || undefined, trainability: Number(trainability) || undefined, shedding_level: Number(shedding_level) || undefined, suitable_for, sort } as any;

  // 2. Lấy danh sách breeds đã được lọc từ wikiService
  const filteredBreedsResult = await wikiService.getAllBreeds(options);

  let userCollectionMap = new Map();
  if (userId) {
    // 2. If user is logged in, get their collection
    const userCollection = await collectionService.getUserCollection(userId);
    userCollection.forEach(item => {
      userCollectionMap.set(item.breed_id._id.toString(), {
        collected: true,
        count: item.collection_count,
        first_collected_at: item.first_collected_at,
      });
    });
  }

  // 3. Combine the two lists
  const pokedex = filteredBreedsResult.data.map(breed => ({
    collection_status: userCollectionMap.get((breed as any)._id.toString()) || { collected: false, count: 0 },
    ...breed.toObject(),
  }));

  const collectedCount = userCollectionMap.size;
  const totalBreedsInSystem = await DogBreedWikiModel.countDocuments({ isDeleted: { $ne: true } });

  res.status(200).json({
    message: "Lấy Pokedex thành công.",
    data: {
      ...filteredBreedsResult, // Trả về cả thông tin phân trang
      data: pokedex, // Ghi đè data bằng pokedex đã được làm giàu
      progress: {
        collected: collectedCount,
        total: totalBreedsInSystem,
        percentage: totalBreedsInSystem > 0 ? (collectedCount / totalBreedsInSystem) * 100 : 0,
      }
    }
  });
};

export const addBreed = async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const { slug } = req.params;

  // 1. Add breed to collection
  await collectionService.addOrUpdateCollection(userId, slug);

  // 2. Check for new achievements
  const userCollections = await UserCollectionModel.find({ user_id: userId });
  const achievements = await achievementService.getUserAchievements(userId.toString(), userCollections);

  res.status(200).json({
    message: `Đã thêm giống chó '${slug}' vào bộ sưu tập.`,
    data: { achievements }
  });
};

export const getAchievements = async (req: Request, res: Response) => {
  try {
    const userId = req.user?._id || req.body.userId || req.query.userId;
    if (!userId) return res.status(400).json({ message: 'Missing userId' });
    const userCollections = await UserCollectionModel.find({ user_id: userId });
    const achievements = await achievementService.getUserAchievements(userId, userCollections);
    res.json({ achievements });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching achievements', error: err });
  }
};

export const getStats = async (req: Request, res: Response) => {
  const userId = req.user!._id;

  const [totalCollected, totalCount, topBreeds] = await Promise.all([
    UserCollectionModel.countDocuments({ user_id: userId }),
    UserCollectionModel.aggregate([
      { $match: { user_id: userId } },
      { $group: { _id: null, total: { $sum: "$collection_count" } } }
    ]),
    UserCollectionModel.find({ user_id: userId }).sort({ collection_count: -1 }).limit(5).populate('breed_id', 'display_name slug')
  ]);

  res.status(200).json({
    data: {
      unique_breeds_collected: totalCollected,
      total_predictions_in_collection: totalCount[0]?.total || 0,
      top_5_collected_breeds: topBreeds,
    }
  });
};
