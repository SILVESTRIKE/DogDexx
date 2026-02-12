import Achievement, { IAchievement } from '../models/achievement.model';
import { getDogBreedWikiModel } from '../models/dogs_wiki.model';
import { UserModel, UserDoc } from '../models/user.model';
import { logger } from '../utils/logger.util';
let cachedAchievements: IAchievement[] | null = null;
const totalBreedsCache = new Map<'vi' | 'en', number>();

export const achievementService = {
  async processUserAchievements(user: UserDoc, userCollections: any[], lang: 'vi' | 'en' = 'vi') {
    const WikiModel = getDogBreedWikiModel(lang);

    const allAchievementDefinitions = await this.getAllAchievementDefinitions();

    const unlockedKeys = new Set(user.achievements.map(ach => ach.key));

    if (!totalBreedsCache.has(lang)) {
      const count = await WikiModel.countDocuments({ isDeleted: { $ne: true } });
      totalBreedsCache.set(lang, count);
    }
    const totalBreedsInDB = totalBreedsCache.get(lang)!;

    const collectedBreedDetails = await WikiModel.find({
      _id: { $in: userCollections.map(uc => uc.breed_id) }
    }).select('slug');
    const collectedBreedSlugs = new Set(collectedBreedDetails.map(b => b.slug));

    const collectionCount = userCollections.length;

    const achievementsWithStatus = allAchievementDefinitions.map(ach => {
      const flattenedAch = {
        ...ach.toObject(),
        name: ach.name[lang],
        description: ach.description[lang],
      };

      const isAlreadyUnlocked = unlockedKeys.has(ach.key);
      if (isAlreadyUnlocked) {
        return { ...flattenedAch, unlocked: true };
      }

      const isNewlyUnlocked = this.isAchievementConditionMet(ach, collectionCount, collectedBreedSlugs, totalBreedsInDB);
      return { ...flattenedAch, unlocked: isNewlyUnlocked };
    });

    const newlyUnlocked = achievementsWithStatus.filter(ach => ach.unlocked && !unlockedKeys.has(ach.key));

    if (newlyUnlocked.length > 0) {
      const newAchievementsToEmbed = newlyUnlocked.map(ach => ({
        key: ach.key,
        unlockedAt: new Date()
      }));

      await UserModel.updateOne(
        { _id: user._id },
        { $push: { achievements: { $each: newAchievementsToEmbed } } }
      );
      logger.info(`User ${user.username} unlocked ${newlyUnlocked.length} new achievements.`);
    }

    return achievementsWithStatus;
  },

  async getAllAchievementDefinitions(): Promise<IAchievement[]> {
    if (!cachedAchievements) {
      cachedAchievements = await Achievement.find();
    }
    return cachedAchievements as IAchievement[];
  },

  isAchievementConditionMet(
    achievement: IAchievement,
    collectionCount: number,
    collectedSlugs: Set<string>,
    totalBreeds: number | null
  ): boolean {
    switch (achievement.condition.type) {
      case 'collection_count':
        return collectionCount >= achievement.condition.value;
      case 'rare_breed':
        return collectedSlugs.has(achievement.condition.breedSlug || '');
      case 'all_breeds':
        return collectionCount >= (totalBreeds || achievement.condition.value);
      case 'custom':
        return false;
      default:
        return false;
    }
  }
};
