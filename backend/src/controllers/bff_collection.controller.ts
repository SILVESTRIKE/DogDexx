// bff_collection.controller.ts
import { Request, Response, NextFunction } from 'express';
import { wikiService } from '../services/dogs_wiki.service';
import { collectionService } from '../services/user_collections.service';
import { achievementService } from '../services/achievement.service';
import { transformMediaURLs } from '../utils/media.util';
import { userService } from '../services/user.service';
import { logger } from '../utils/logger.util';
import { BadRequestError, NotFoundError } from '../errors';
import { Types } from 'mongoose';
import { redisClient } from '../utils/redis.util';
import { REDIS_KEYS } from '../constants/redis.constants';

// Define a type for the enriched breed object sent to the frontend
export type DogDexBreed = {
  slug: string;
  breed: string;
  group?: string;
  pokedexNumber?: number;
  origin?: string;
  mediaUrl?: string;
  rarity_level?: number;
  isCollected: boolean;
  collectedAt: Date | null;
  source: string | null;
};

export const getDogDex = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?._id;
    const lang = (req.query.lang === 'vi' || req.query.lang === 'en') ? req.query.lang as 'vi' | 'en' : 'en';

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
      lang,
    };

    let collectedBreedsCount = 0;
    const userCollectionMap = new Map<string, { collectedAt: Date; source: string }>();

    // 2. Nếu user đã đăng nhập, LUÔN LUÔN lấy dữ liệu bộ sưu tập của họ
    if (userId) {
      const userCollection = await collectionService.getUserCollection(userId, lang);
      collectedBreedsCount = userCollection.length;

      userCollection.forEach((item: any) => {
        if (item.breed_id?.slug && item.first_prediction_id) {
          userCollectionMap.set(item.breed_id.slug, {
            collectedAt: item.first_prediction_id?.createdAt,
            source: item.first_prediction_id?.source
          });
        }
      });

      // 3. Áp dụng bộ lọc isCollected NẾU nó được cung cấp
      const collectedBreedIds = userCollection.map((item: any) => item.breed_id?._id).filter(id => id);
      if (userId && isCollected === 'true') {
        options.ids = collectedBreedIds.length > 0 ? collectedBreedIds : [new Types.ObjectId()];
      } else if (isCollected === 'false') {
        options.excludeIds = collectedBreedIds;
      }
    }

    // 4. Gọi Wiki Service MỘT LẦN DUY NHẤT với tất cả các options
    const [breedsResult, totalBreedsInSystem] = await Promise.all([
      wikiService.getAllBreeds(options),
      wikiService.getTotalBreedsCount(lang)
    ]);

    // 5. "Làm giàu" kết quả với thông tin thu thập và biến đổi URL media
    let breedsResponse: DogDexBreed[] = transformMediaURLs(req, breedsResult.data).map((breed: any) => {
      const collectionInfo = userCollectionMap.get(breed.slug);
      return {
        slug: breed.slug,
        breed: breed.breed,
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

    // 5.5. Sắp xếp ở tầng ứng dụng bằng cách gọi service
    breedsResponse = collectionService.sortDogDex(breedsResponse, sort as string);

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
  } catch (error) {
    next(error);
  }
};

export const addBreed = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!._id;

    throw new BadRequestError("Manual collection is not supported in this version.");

    /*
    const userCollections = await collectionService.getUserCollection(userId);
    const user = await userService.getById(userId.toString());

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const lang = (req.headers['accept-language']?.split(',')[0].toLowerCase() === 'vi') ? 'vi' : 'en';
    const achievements = await achievementService.processUserAchievements(user, userCollections, lang);
    const unlockedAchievements = achievements.filter(a => a.unlocked);

    const nextAchievement = achievements.find(a => !a.unlocked && a.condition.type === 'collection_count');

    res.status(200).json({
      success: true,
      isNew: false,
      totalCollected: userCollections.length,
      achievementsUnlocked: unlockedAchievements.map(a => a.key),
      nextAchievement: nextAchievement
        ? {
            name: nextAchievement.name,
            requirement: nextAchievement.condition.value,
            progress: userCollections.length,
          }
        : null,
    });
    */
  } catch (error) {
    next(error);
  }
};

export const getAchievements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!._id;
    const lang = (req.query.lang === 'vi' || req.query.lang === 'en')
      ? req.query.lang as 'vi' | 'en'
      : (req.headers['accept-language']?.split(',')[0].toLowerCase() === 'vi') ? 'vi' : 'en';

    const cacheKey = `${REDIS_KEYS.USER_ACHIEVEMENTS_PREFIX}${userId}:${lang}`;
    const lockKey = `${cacheKey}:lock`;
    const lockDuration = 5000;
    const waitInterval = 100;
    const maxRetries = 20;

    if (redisClient) {
      let attempts = 0;
      while (attempts < maxRetries) {
        // 1. Try cache
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          logger.info(`[Achievements] Cache HIT for user ${userId}, lang ${lang}.`);
          return res.status(200).json(JSON.parse(cachedData));
        }

        // 2. Try lock
        const acquired = await redisClient.set(lockKey, 'locked', { NX: true, EX: 5 });
        if (acquired) {
          logger.info(`[Achievements] Lock acquired for user ${userId}. Processing...`);
          break;
        }

        // 3. Wait
        logger.info(`[Achievements] Lock busy for user ${userId}. Waiting...`);
        await new Promise(resolve => setTimeout(resolve, waitInterval));
        attempts++;
      }
      if (attempts >= maxRetries) {
        logger.warn(`[Achievements] Lock timeout for user ${userId}. Proceeding without lock/cache.`);
      }
    }

    if (!userId) throw new NotFoundError('User not found to get achievements.');
    const [user, userCollections, totalBreedsInSystem] = await Promise.all([
      userService.getById(userId.toString()),
      collectionService.getUserCollection(userId, lang),
      wikiService.getTotalBreedsCount(lang),
    ]);

    if (!user) {
      if (redisClient) await redisClient.del(lockKey);
      throw new NotFoundError('User not found');
    }

    const achievementsResult = await achievementService.processUserAchievements(user, userCollections, lang);
    const unlockedMap = new Map(user.achievements.map(ua => [ua.key, ua.unlockedAt]));
    const unlockedCount = achievementsResult.filter(a => a.unlocked).length;
    const nextAchievement = achievementsResult.find(a => !a.unlocked && a.condition.type === 'collection_count');

    const responseData = {
      stats: {
        totalAchievements: achievementsResult.length,
        totalBreeds: totalBreedsInSystem,
        unlockedAchievements: unlockedCount,
        totalCollected: userCollections.length,
      },
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
        requiredCount: ach.condition?.value || 0,
        unlocked: ach.unlocked,
        unlockedAt: unlockedMap.get(ach.key) || null,
      }))
    };

    if (redisClient) {
      await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 300 });
      await redisClient.del(lockKey);
      logger.info(`[Achievements] Cache SET and Lock RELEASED for user ${userId}.`);
    }

    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};

export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!._id;
    const stats = await collectionService.getCollectionStats(userId);

    res.status(200).json({
      data: {
        unique_breeds_collected: stats.totalCollected,
        total_predictions_in_collection: stats.totalPredictionsInCollection,
        top_5_collected_breeds: stats.topBreeds,
      }
    });
  } catch (error) {
    next(error);
  }
};
export const getAchievementStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!._id;
    const lang = (req.query.lang === 'vi' || req.query.lang === 'en')
      ? req.query.lang as 'vi' | 'en'
      : 'en';

    const cacheKey = `${REDIS_KEYS.USER_ACHIEVEMENT_STATS_PREFIX}${userId}:${lang}`;
    const lockKey = `${cacheKey}:lock`;
    const lockDuration = 5000; // 5 seconds (milliseconds handled by pSet if needed, but SET NX EX uses seconds)
    const waitInterval = 100; // 100ms
    const maxRetries = 20; // 2 seconds timeout

    if (redisClient) {
      let attempts = 0;
      while (attempts < maxRetries) {
        // 1. Try to get data from cache
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
          logger.info(`[Achievement Stats] Cache HIT for user ${userId}, lang ${lang}.`);
          return res.status(200).json(JSON.parse(cachedData));
        }

        // 2. Try to acquire lock
        // NX: Only set if key does not exist. EX: Expire in 5 seconds.
        const acquired = await redisClient.set(lockKey, 'locked', { NX: true, EX: 5 });

        if (acquired) {
          logger.info(`[Achievement Stats] Lock acquired for user ${userId}. Processing...`);
          // Lock acquired! Exitting loop to proceed with computation
          break;
        }

        // 3. Lock busy, wait and retry
        logger.info(`[Achievement Stats] Lock busy for user ${userId}. Waiting...`);
        await new Promise(resolve => setTimeout(resolve, waitInterval));
        attempts++;
      }

      if (attempts >= maxRetries) {
        logger.warn(`[Achievement Stats] Lock timeout for user ${userId}. Proceeding without lock/cache.`);
      }
    } else {
      logger.warn('[Achievement Stats] Redis not available.');
    }

    const [user, userCollections, totalBreedsInSystem] = await Promise.all([
      userService.getById(userId.toString()),
      collectionService.getUserCollection(userId, lang),
      wikiService.getTotalBreedsCount(lang),
    ]);

    if (!user) {
      // Release lock if we acquired it (checking isn't strictly necessary as it auto-expires, but good practice)
      if (redisClient) await redisClient.del(lockKey);
      throw new NotFoundError('User not found');
    }

    const achievementsResult = await achievementService.processUserAchievements(user, userCollections, lang);
    const unlockedCount = achievementsResult.filter(a => a.unlocked).length;

    const responseData = {
      totalAchievements: achievementsResult.length,
      totalBreeds: totalBreedsInSystem,
      unlockedAchievements: unlockedCount,
      totalCollected: userCollections.length,
    };

    if (redisClient) {
      await redisClient.set(cacheKey, JSON.stringify(responseData), { EX: 300 });
      await redisClient.del(lockKey); // Release lock
      logger.info(`[Achievement Stats] Cache SET and Lock RELEASED for user ${userId}.`);
    }

    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};
