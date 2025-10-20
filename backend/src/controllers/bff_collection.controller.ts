// bff_collection.controller.ts
import { Request, Response } from 'express';
import { wikiService } from '../services/dogs_wiki.service';
import { collectionService } from '../services/user_collections.service';
import { achievementService } from '../services/achievement.service';
import { transformMediaURLs } from '../utils/media.util';
import { userService } from '../services/user.service';
import { BadRequestError, NotFoundError } from '../errors';
import { Types } from 'mongoose';

export const getPokedex = async (req: Request, res: Response) => {
  const userId = req.user?._id;

  // 1. Lấy và chuẩn bị các tham số query
  const {
    page = 1,
    limit = 20,
    search,
    group,
    energy_level,
    trainability,
    shedding_level,
    suitable_for,
    sort,
    isCollected
  } = req.query;

  const options: any = {
    page: Number(page),
    limit: Number(limit),
    search,
    group,
    energy_level: energy_level ? Number(energy_level) : undefined,
    trainability: trainability ? Number(trainability) : undefined,
    shedding_level: shedding_level ? Number(shedding_level) : undefined,
    suitable_for,
    sort,
  };

  let collectedBreedsCount = 0;
  const userCollectionMap = new Map<string, { collectedAt: Date; source: string }>();

  // 2. Nếu user đã đăng nhập, LUÔN LUÔN lấy dữ liệu bộ sưu tập của họ
  if (userId) {
    const userCollection = await collectionService.getUserCollection(userId);
    collectedBreedsCount = userCollection.length;

    userCollection.forEach((item: any) => {
      // Dữ liệu đã được populate và lean()
      if (item.breed_id?.slug && item.first_prediction_id) {
        userCollectionMap.set(item.breed_id.slug, {
          collectedAt: item.first_prediction_id?.createdAt,
          source: item.first_prediction_id?.source
        });
      }
    });
    
    // 3. Áp dụng bộ lọc isCollected NẾU nó được cung cấp
    const collectedBreedIds = userCollection.map((item: any) => item.breed_id?._id).filter(id => id);
    if (isCollected === 'true') {
      // Nếu không có con chó nào được sưu tầm, trả về một ID không thể tồn tại để đảm bảo kết quả rỗng
      options.ids = collectedBreedIds.length > 0 ? collectedBreedIds : [new Types.ObjectId()];
    } else if (isCollected === 'false') {
      options.excludeIds = collectedBreedIds;
    }
  }

  // 4. Gọi Wiki Service MỘT LẦN DUY NHẤT với tất cả các options
  const breedsResult = await wikiService.getAllBreeds(options);

  const totalBreedsInSystem = await wikiService.getTotalBreedsCount();

  // 5. "Làm giàu" kết quả với thông tin thu thập và biến đổi URL media
  const breedsResponse = transformMediaURLs(req, breedsResult.data).map((breed: any) => {
    const collectionInfo = userCollectionMap.get(breed.slug);
    return {
      slug: breed.slug,
      breed: breed.breed,
      name: breed.breed,
      group: breed.group,
      pokedexNumber: breed.pokedexNumber,
      origin: breed.origin,
      mediaUrl: breed.mediaUrl,
      rarity_level: breed.rarity_level,
      isCollected: !!collectionInfo,
      collectedAt: collectionInfo?.collectedAt || null,
      source: collectionInfo?.source || null,
    };
  });

  // 6. Trả về kết quả cuối cùng
  res.status(200).json({
    stats: {
      totalBreeds: totalBreedsInSystem,
      collectedBreeds: collectedBreedsCount,
      progress: totalBreedsInSystem > 0 ? (collectedBreedsCount / totalBreedsInSystem) * 100 : 0,
    },
    breeds: breedsResponse,
    pagination: breedsResult.pagination,
  });
};

export const addBreed = async (req: Request, res: Response) => {
  const userId = req.user!._id;

  // Với kiến trúc mới, việc thêm thủ công không được hỗ trợ
  throw new BadRequestError("Manual collection is not supported in this version.");

  /*
  // Logic dưới đây sẽ không được thực thi, nhưng đã được sửa lỗi để tham khảo
  const userCollections = await collectionService.getUserCollection(userId);
  const user = await userService.getById(userId.toString());

  // SỬA LỖI 1: Kiểm tra `user` có tồn tại không
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const lang = (req.headers['accept-language']?.split(',')[0].toLowerCase() === 'vi') ? 'vi' : 'en';
  // Bây giờ `user` chắc chắn không phải là null
  const achievements = await achievementService.processUserAchievements(user, userCollections, lang);
  const unlockedAchievements = achievements.filter(a => a.unlocked);

  const nextAchievement = achievements.find(a => !a.unlocked && a.condition.type === 'collection_count');

  res.status(200).json({
    success: true,
    isNew: false,
    totalCollected: userCollections.length,
    achievementsUnlocked: unlockedAchievements.map(a => a.key),
    // SỬA LỖI 2 & 3: Kiểm tra `nextAchievement` trước khi truy cập thuộc tính
    nextAchievement: nextAchievement
      ? {
          name: nextAchievement.name,
          requirement: nextAchievement.condition.value,
          progress: userCollections.length,
        }
      : null,
  });
  */
};

export const getAchievements = async (req: Request, res: Response) => {
  const userId = req.user!._id;
  const lang = (req.query.lang === 'vi' || req.query.lang === 'en')
    ? req.query.lang as 'vi' | 'en'
    : (req.headers['accept-language']?.split(',')[0].toLowerCase() === 'vi') ? 'vi' : 'en';

  const [user, userCollections, totalBreedsInSystem] = await Promise.all([
    userService.getById(userId.toString()),
    collectionService.getUserCollection(userId),
    wikiService.getTotalBreedsCount(),
  ]);

  // SỬA LỖI 1: Kiểm tra `user` có tồn tại không
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const achievementsResult = await achievementService.processUserAchievements(user, userCollections, lang);
  const unlockedMap = new Map(user.achievements.map((ua: any) => [ua.key, ua.unlockedAt]));
  const unlockedCount = achievementsResult.filter(a => a.unlocked).length;
  const nextAchievement = achievementsResult.find(a => !a.unlocked && a.condition.type === 'collection_count');

  res.json({
    stats: {
      totalAchievements: achievementsResult.length,
      totalBreeds: totalBreedsInSystem,
      unlockedAchievements: unlockedCount,
      totalCollected: userCollections.length,
    },
    // SỬA LỖI 2 & 3: Kiểm tra `nextAchievement` trước khi truy cập thuộc tính
    nextAchievement: nextAchievement
      ? {
          name: nextAchievement.name,
          requirement: nextAchievement.condition.value,
          progress: userCollections.length,
        }
      : null,
    achievements: achievementsResult.map(ach => ({
      id: ach.key,
      title: ach.name,
      description: ach.description,
      icon: ach.icon || '🏆',
      requiredCount: ach.condition.value,
      unlocked: ach.unlocked,
      unlockedAt: unlockedMap.get(ach.key) || null,
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