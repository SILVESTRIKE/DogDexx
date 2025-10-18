import Achievement, { IAchievement } from '../models/achievement.model';
import { UserCollectionDoc } from '../models/user_collection.model';
import { DogBreedWikiModel } from '../models/dogs_wiki.model';
import { UserModel } from '../models/user.model';
import { PlainUser } from './user.service';

let cachedAchievements: IAchievement[] | null = null;
let totalBreedsInDB: number | null = null;

export const achievementService = {
  async processUserAchievements(user: PlainUser, userCollections: UserCollectionDoc[]) {
    const allAchievements = await this.getAllAchievementDefinitions();
    
    // Lấy các key thành tích đã mở khóa từ chính document user
    const unlockedKeys = new Set(user.achievements.map(ach => ach.key));

    if (totalBreedsInDB === null) {
        console.log("Caching total breed count from DB...");
        totalBreedsInDB = await DogBreedWikiModel.countDocuments({ isDeleted: { $ne: true } });
    }
    
    // Lấy thông tin chi tiết của các breed đã sưu tầm để có slug
    const collectedBreedDetails = await DogBreedWikiModel.find({
      _id: { $in: userCollections.map(uc => uc.breed_id) }
    }).select('slug');
    const collectedBreedSlugs = new Set(collectedBreedDetails.map(b => b.slug));

    const collectionCount = userCollections.length;

    // Tính toán trạng thái unlock cho từng achievement
    const achievementsWithStatus = allAchievements.map(ach => {
      // Một thành tích được coi là đã mở khóa nếu nó có trong danh sách của user HOẶC nó thỏa mãn điều kiện hiện tại
      const isUnlockedNow = this.isAchievementConditionMet(ach, collectionCount, collectedBreedSlugs, totalBreedsInDB);
      return { ...ach, unlocked: unlockedKeys.has(ach.key) || isUnlockedNow };
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
      console.log(`User ${user.username} unlocked ${newlyUnlocked.length} new achievements.`);
    }

    return achievementsWithStatus;
  },

  /**
   * Helper: Lấy tất cả định nghĩa thành tích (cache-aware)
   */
  async getAllAchievementDefinitions(): Promise<IAchievement[]> {
    if (!cachedAchievements) {
      cachedAchievements = await Achievement.find().lean();
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
