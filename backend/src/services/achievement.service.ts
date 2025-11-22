import Achievement, { IAchievement } from '../models/achievement.model';
import { getDogBreedWikiModel } from '../models/dogs_wiki.model';
import { UserModel, UserDoc } from '../models/user.model';
import { logger } from '../utils/logger.util';
let cachedAchievements: IAchievement[] | null = null;
// Sửa lỗi: Cache totalBreeds theo ngôn ngữ
const totalBreedsCache = new Map<'vi' | 'en', number>();

export const achievementService = {
  async processUserAchievements(user: UserDoc, userCollections: any[], lang: 'vi' | 'en' = 'vi') {
    const WikiModel = getDogBreedWikiModel(lang);

    // Lấy định nghĩa gốc (chưa flatten)
    const allAchievementDefinitions = await this.getAllAchievementDefinitions();
    
    // Lấy các key thành tích đã mở khóa từ chính document user
    const unlockedKeys = new Set(user.achievements.map(ach => ach.key));

    // Sửa lỗi: Lấy và cache totalBreeds theo ngôn ngữ
    if (!totalBreedsCache.has(lang)) {
        const count = await WikiModel.countDocuments({ isDeleted: { $ne: true } });
        totalBreedsCache.set(lang, count);
    }
    const totalBreedsInDB = totalBreedsCache.get(lang)!;
    
    // Lấy thông tin chi tiết của các breed đã sưu tầm để có slug
    const collectedBreedDetails = await WikiModel.find({
      _id: { $in: userCollections.map(uc => uc.breed_id) }
    }).select('slug');
    const collectedBreedSlugs = new Set(collectedBreedDetails.map(b => b.slug));

    const collectionCount = userCollections.length;

    // Tính toán trạng thái unlock cho từng achievement
    const achievementsWithStatus = allAchievementDefinitions.map(ach => {
      // "Phẳng hóa" (flatten) dữ liệu ngôn ngữ tại đây
      const flattenedAch = {
        ...ach.toObject(),
        name: ach.name[lang],
        description: ach.description[lang],
      };

      const isAlreadyUnlocked = unlockedKeys.has(ach.key);
      if (isAlreadyUnlocked) {
        return { ...flattenedAch, unlocked: true };
      }

      // Chỉ kiểm tra điều kiện cho những thành tích chưa được mở khóa
      // Sử dụng `ach` (bản gốc) để kiểm tra điều kiện, vì `flattenedAch` đã thay đổi cấu trúc
      const isNewlyUnlocked = this.isAchievementConditionMet(ach, collectionCount, collectedBreedSlugs, totalBreedsInDB);
      return { ...flattenedAch, unlocked: isNewlyUnlocked };
    });

    // Tìm các thành tích MỚI được mở khóa và ghi vào DB
    const newlyUnlocked = achievementsWithStatus.filter(ach => ach.unlocked && !unlockedKeys.has(ach.key));

    if (newlyUnlocked.length > 0) {
      const newAchievementsToEmbed = newlyUnlocked.map(ach => ({
        key: ach.key,
        unlockedAt: new Date()
      }));

      // Thêm các thành tích mới vào mảng achievements của user
      await UserModel.updateOne(
        { _id: user._id },
        { $push: { achievements: { $each: newAchievementsToEmbed } } }
      );
      logger.info(`User ${user.username} unlocked ${newlyUnlocked.length} new achievements.`);
    }

    return achievementsWithStatus;
  },

  /**
   * Helper: Lấy tất cả định nghĩa thành tích (cache-aware)
   */
  async getAllAchievementDefinitions(): Promise<IAchievement[]> {
    if (!cachedAchievements) {
      cachedAchievements = await Achievement.find();
    } 
    return cachedAchievements as IAchievement[];
  },

  /**
   * Helper: Kiểm tra điều kiện mở khóa của một thành tích
   */
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
        return false; // Logic tùy chỉnh
      default:
        return false;
      }
    }
};
