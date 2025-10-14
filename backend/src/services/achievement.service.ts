// Achievement Service
import Achievement, { IAchievement } from '../models/achievement.model';
import { UserCollectionDoc } from '../models/user_collection.model';

export async function getUserAchievements(userId: string, userCollections: UserCollectionDoc[]) {
  // Lấy tất cả achievements
  const achievements: IAchievement[] = await Achievement.find();
  // Danh sách breed_id đã collect
  const collectedBreedIds = userCollections.map(uc => uc.breed_id.toString());
  // Tính trạng thái unlock cho từng achievement
  return achievements.map(ach => {
    let unlocked = false;
    switch (ach.condition.type) {
      case 'collection_count':
        unlocked = userCollections.length >= ach.condition.value;
        break;
      case 'rare_breed':
        unlocked = collectedBreedIds.includes(ach.condition.breedSlug || '');
        break;
      case 'all_breeds':
        unlocked = userCollections.length === ach.condition.value;
        break;
      case 'custom':
        // Custom logic nếu cần
        unlocked = false;
        break;
    }
    return {
      ...ach.toObject(),
      unlocked
    };
  });
}
