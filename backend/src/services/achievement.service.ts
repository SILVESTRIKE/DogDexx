import Achievement, { IAchievement } from '../models/achievement.model';
import { UserCollectionDoc } from '../models/user_collection.model';
import { DogBreedWikiModel } from '../models/dogs_wiki.model';

let cachedAchievements: IAchievement[] | null = null;
let totalBreedsInDB: number | null = null;

export const achievementService = {
  async getUserAchievements(userId: string, userCollections: UserCollectionDoc[]) {
    // Lấy tất cả achievements từ cache hoặc DB
    if (!cachedAchievements) {
      console.log("Caching achievements from DB...");
      cachedAchievements = await Achievement.find();
    }
    
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

    // --- Tự động tạo các thành tích "Sưu tầm X giống chó" ---
    const dynamicCollectionAchievements: IAchievement[] = [];
    // Chỉ tạo ra thành tích cột mốc tiếp theo mà người dùng cần đạt được
    const nextMilestone = Math.floor(collectionCount / 10) * 10 + 10;

    // Chỉ tạo nếu cột mốc này chưa tồn tại trong DB và nhỏ hơn tổng số breed
    if (totalBreedsInDB && nextMilestone <= totalBreedsInDB && !cachedAchievements.some(ach => ach.condition.type === 'collection_count' && ach.condition.value === nextMilestone)) {
      dynamicCollectionAchievements.push({
        key: `collect-${nextMilestone}`,
        name: `Nhà Sưu Tầm ${nextMilestone / 10}`,
        description: `Sưu tầm ${nextMilestone} giống chó khác nhau.`,
        condition: { type: 'collection_count', value: nextMilestone },
        // Bạn có thể thêm icon mặc định ở đây
      } as IAchievement);
    }

    const allAchievements = [...cachedAchievements, ...dynamicCollectionAchievements];

    // Tính trạng thái unlock cho từng achievement
    return allAchievements.map(ach => {
      let unlocked = false;
      switch (ach.condition.type) {
        case 'collection_count':
          unlocked = collectionCount >= ach.condition.value;
          break;
        case 'rare_breed':
          // Sửa lỗi: So sánh slug với slug, không phải slug với ID
          unlocked = collectedBreedSlugs.has(ach.condition.breedSlug || '');
          break;
        case 'all_breeds':
          // So sánh với tổng số breed thực tế trong DB
          unlocked = collectionCount >= (totalBreedsInDB || ach.condition.value);
          break;
        case 'custom':
          // Custom logic nếu cần
          unlocked = false;
          break;
      }
      // Nếu ach là document từ Mongoose, gọi toObject(), ngược lại thì giữ nguyên
      const achObject = typeof ach.toObject === 'function' ? ach.toObject() : ach;
      return { ...achObject, unlocked };
    });
  }
};
