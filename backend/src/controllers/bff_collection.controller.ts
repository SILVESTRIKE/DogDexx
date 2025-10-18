import { Request, Response, NextFunction } from 'express';
import { wikiService } from '../services/dogs_wiki.service';
import { collectionService } from '../services/user_collections.service';
import { Types } from 'mongoose';
import { achievementService } from '../services/achievement.service';
import { DogBreedWikiDoc } from '../models/dogs_wiki.model';
import { userService } from '../services/user.service';

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
   
      if (item.breed_id && (item.breed_id as any)._id) {
        userCollectionMap.set((item.breed_id as any)._id.toString(), item.first_collected_at);
      }
    });

    breedsResponse = filteredBreedsResult.data.map(breed => {
      const breedObj = breed as DogBreedWikiDoc; // Dữ liệu đã là object thuần túy từ .lean()
      const collectedAt = userCollectionMap.get((breedObj._id as Types.ObjectId).toString());
      return {
        id: breedObj._id,
        name: breedObj.breed, // Sửa từ display_name
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
      const breedObj = breed as DogBreedWikiDoc; // Dữ liệu đã là object thuần túy từ .lean()
      return {
        id: breedObj._id,
        name: breedObj.breed, // Sửa từ display_name
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
  const userCollections = await collectionService.getUserCollection(userId);
  const user = await userService.getById(userId.toString());
  if (!user) return res.status(404).json({ message: 'User not found' });
  const achievements = await achievementService.processUserAchievements(user, userCollections);
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
  const userId = req.user!._id;

  // Lấy song song user, bộ sưu tập, và tổng số giống chó trong DB
  const [user, userCollections, totalBreedsInSystem] = await Promise.all([
    userService.getById(userId.toString()),
    collectionService.getUserCollection(userId),
    wikiService.getTotalBreedsCount(), // <-- THÊM LỆNH GỌI NÀY
  ]);

  if (!user) return res.status(404).json({ message: 'User not found' });
  
  const achievementsResult = await achievementService.processUserAchievements(user, userCollections); // user đã là PlainUser từ service
  const unlockedMap = new Map(user.achievements.map((ua: { key: string; unlockedAt: Date }) => [ua.key, ua.unlockedAt]));

  const unlockedCount = achievementsResult.filter(a => a.unlocked).length;
  const nextAchievement = achievementsResult.find(a => !a.unlocked && a.condition.type === 'collection_count');

  res.json({
    stats: {
      totalAchievements: achievementsResult.length,
      totalBreeds: totalBreedsInSystem, // <-- THÊM TRƯỜNG NÀY
      unlockedAchievements: unlockedCount,
      totalCollected: userCollections.length,
    },
    nextAchievement: nextAchievement ? {
      name: nextAchievement.name,
      requirement: nextAchievement.condition.value,
      progress: userCollections.length,
    } : null,
    achievements: achievementsResult.map(ach => ({
      id: ach.key, // Giữ nguyên id
      title: ach.name, // Đổi name thành title
      description: ach.description,
      icon: ach.icon || '🐕', // Cần thêm trường icon vào model
      requiredCount: ach.condition.value, // Đổi requirement thành requiredCount
      unlocked: ach.unlocked, // Đổi isUnlocked thành unlocked
      unlockedAt: unlockedMap.get(ach.key) || null, // Lấy ngày mở khóa trực tiếp từ DB
    }))
  });
};

export const getStats = async (req: Request, res: Response) => {
  const userId = req.user!._id;

  const stats = await collectionService.getCollectionStats(userId);

  res.status(200).json({
    data: {
      unique_breeds_collected: stats.totalCollected,
      total_predictions_in_collection: stats.totalPredictionsInCollection,
      top_5_collected_breeds: stats.topBreeds,
    }
  });
};
