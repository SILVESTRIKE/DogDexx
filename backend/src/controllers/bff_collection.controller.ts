import { Request, Response } from 'express';
import { wikiService } from '../services/dogs_wiki.service';
import { collectionService } from '../services/user_collections.service';
import { Types } from 'mongoose';
import { achievementService } from '../services/achievement.service';
import { UserCollectionModel } from '../models/user_collection.model';
import { DogBreedWikiModel, DogBreedWikiDoc } from '../models/dogs_wiki.model';

export const getPokedex = async (req: Request, res: Response) => {
  const userId = req.user?._id;

  // 1. Lấy các tham số query để lọc và phân trang
  const { page = 1, limit = 20, search, group, energy_level, trainability, shedding_level, suitable_for, sort } = req.query;
  const options = { page: Number(page), limit: Number(limit), search, group, energy_level: Number(energy_level) || undefined, trainability: Number(trainability) || undefined, shedding_level: Number(shedding_level) || undefined, suitable_for, sort } as any;

  // 2. Lấy danh sách breeds đã được lọc từ wikiService
  const filteredBreedsResult = await wikiService.getAllBreeds(options);

  const totalBreedsInSystem = filteredBreedsResult.total;
  let collectedBreeds = 0;
  let breedsResponse = [];

  if (userId) {
    let userCollectionMap = new Map();
    const userCollection = await collectionService.getUserCollection(userId);
    collectedBreeds = userCollection.length;
    userCollection.forEach(item => {
      userCollectionMap.set(item.breed_id._id.toString(), item.first_collected_at);
    });

    breedsResponse = filteredBreedsResult.data.map(breed => {
      const breedObj = breed.toObject() as DogBreedWikiDoc;
      const collectedAt = userCollectionMap.get((breedObj._id as Types.ObjectId).toString());
      return {
        id: breedObj._id,
        name: breedObj.display_name,
        slug: breedObj.slug,
        group: breedObj.group,
        origin: (breedObj as any).origin, // Cần thêm trường origin
        imageUrl: (breedObj as any).image_url, // Cần thêm trường image_url
        isCollected: !!collectedAt,
        collectedAt: collectedAt || null,
      };
    });
  } else {
    // User is not logged in
    breedsResponse = filteredBreedsResult.data.map(breed => {
      const breedObj = breed.toObject() as DogBreedWikiDoc;
      return {
        id: breedObj._id,
        name: breedObj.display_name,
        slug: breedObj.slug,
        group: breedObj.group,
        origin: (breedObj as any).origin,
        imageUrl: (breedObj as any).image_url,
        isCollected: false,
        collectedAt: null,
      };
    });
  }

  res.status(200).json({
    stats: {
      totalBreeds: totalBreedsInSystem,
      collectedBreeds: collectedBreeds,
      progress: totalBreedsInSystem > 0 ? (collectedBreeds / totalBreedsInSystem) * 100 : 0,
    },
    breeds: breedsResponse,
    // Include pagination info
    pagination: {
      total: filteredBreedsResult.total,
      page: filteredBreedsResult.page,
      limit: filteredBreedsResult.limit,
      totalPages: filteredBreedsResult.totalPages,
    },
  });
};

export const addBreed = async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const { slug } = req.params;

  // 1. Add breed to collection
  const { collection, isNew } = await collectionService.addOrUpdateCollection(userId, slug) as unknown as { collection: any, isNew: boolean };

  // 2. Check for new achievements
  const userCollections = await UserCollectionModel.find({ user_id: userId });
  const achievements = await achievementService.getUserAchievements(userId.toString(), userCollections);
  const unlockedAchievements = achievements.filter(a => a.unlocked);

  // 3. Find next achievement
  const nextAchievement = achievements.find(a => !a.unlocked && a.condition.type === 'collection_count');

  res.status(200).json({
    success: true,
    totalCollected: userCollections.length,
    achievementsUnlocked: unlockedAchievements.map(a => a.key),
    nextAchievement: nextAchievement ? {
      name: nextAchievement.name,
      requirement: nextAchievement.condition.value,
      progress: userCollections.length,
    } : null
  });
};

export const getAchievements = async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    if (!userId) return res.status(400).json({ message: 'Missing userId' });

    const userCollections = await UserCollectionModel.find({ user_id: userId });
    const achievementsResult = await achievementService.getUserAchievements(userId.toString(), userCollections);

    const unlockedCount = achievementsResult.filter(a => a.unlocked).length;
    const nextAchievement = achievementsResult.find(a => !a.unlocked && a.condition.type === 'collection_count');

    res.json({
      stats: {
        totalAchievements: achievementsResult.length,
        unlockedAchievements: unlockedCount,
        totalCollected: userCollections.length,
      },
      nextAchievement: nextAchievement ? {
        name: nextAchievement.name,
        requirement: nextAchievement.condition.value,
        progress: userCollections.length,
      } : null,
      achievements: achievementsResult.map(ach => ({
        id: ach.key,
        name: ach.name,
        description: ach.description,
        icon: ach.icon || '🐕', // Cần thêm trường icon vào model
        requirement: ach.condition.value,
        isUnlocked: ach.unlocked,
        unlockedAt: ach.unlocked ? (
          ach.condition.type === 'collection_count' 
            ? userCollections[ach.condition.value - 1]?.first_collected_at // Lấy ngày của breed thứ N
            : userCollections.find(uc => (uc.breed_id as any).slug === ach.condition.breedSlug)?.first_collected_at
        ) || null : null,
      }))
    });
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
