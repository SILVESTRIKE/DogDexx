import { UserCollectionModel } from '../models/user_collection.model';
import { DogBreedWikiModel } from '../models/dogs_wiki.model';
import { Types } from 'mongoose';

export const collectionService = {
  /**
   * Thêm hoặc cập nhật nhiều giống chó vào bộ sưu tập của người dùng.
   * @param userId ID của người dùng
   * @param breedSlugs Mảng các slug của giống chó
   */
  async addOrUpdateManyCollections(userId: Types.ObjectId, breedSlugs: string[]) {
    // Lọc các slug duy nhất
    const uniqueSlugs = [...new Set(breedSlugs)];
    
    // Tìm tất cả breeds có slug trong danh sách
    const breeds = await DogBreedWikiModel.find({ slug: { $in: uniqueSlugs } });
    
    if (breeds.length === 0) {
      console.warn(`Không tìm thấy wiki cho các slug: ${uniqueSlugs.join(', ')}. Bỏ qua.`);
      return;
    }

    // Tạo bulk operation để cập nhật nhiều document cùng lúc
    const bulkOps = breeds.map(breed => ({
      updateOne: {
        filter: { user_id: userId, breed_id: breed._id },
        update: { 
          $inc: { collection_count: 1 },
          $setOnInsert: { first_collected_at: new Date() }
        },
        upsert: true
      }
    }));

    // Thực hiện bulk operation
    const result = await UserCollectionModel.bulkWrite(bulkOps);
    console.log(`Đã cập nhật ${result.modifiedCount + result.upsertedCount} breeds vào bộ sưu tập cho user ${userId}`);
  },

  async addOrUpdateCollection(userId: Types.ObjectId, breedSlug: string) {
    const breed = await DogBreedWikiModel.findOne({ slug: breedSlug });
    if (!breed) {
      console.warn(`Không tìm thấy wiki cho slug: ${breedSlug}. Bỏ qua.`);
      return;
    }

    await UserCollectionModel.findOneAndUpdate(
      { user_id: userId, breed_id: breed._id }, // Điều kiện tìm kiếm
      { 
        $inc: { collection_count: 1 }, // Luôn tăng số lần sưu tầm
        $setOnInsert: { first_collected_at: new Date() } // Chỉ set ngày nếu đây là lần đầu (insert)
      },
      { 
        upsert: true, // Nếu không tìm thấy, tạo mới. Nếu tìm thấy, cập nhật.
        new: true 
      }
    );
    console.log(`Đã cập nhật bộ sưu tập cho user ${userId} với giống chó ${breedSlug}.`);
  },

  /**
   * Lấy bộ sưu tập ("Pokedex") của một người dùng
   */
  async getUserCollection(userId: Types.ObjectId) {
    const collection = await UserCollectionModel.find({ user_id: userId })
      .sort({ first_collected_at: -1 })
      .populate({
        path: 'breed_id',
        model: 'DogBreedWiki',
        select: 'breed slug group' // Lấy các trường cần thiết để hiển thị
      });

    return collection;
  },

  /**
   * Lấy các thống kê về bộ sưu tập của người dùng.
   */
  async getCollectionStats(userId: Types.ObjectId) {
    const [totalCollected, totalCountResult, topBreeds] = await Promise.all([
      // Đếm số lượng giống chó duy nhất đã sưu tầm
      UserCollectionModel.countDocuments({ user_id: userId }),
      // Tính tổng số lần sưu tầm (bao gồm cả các lần trùng lặp)
      UserCollectionModel.aggregate([
        { $match: { user_id: userId } },
        { $group: { _id: null, total: { $sum: "$collection_count" } } }
      ]),
      // Lấy 5 giống chó được sưu tầm nhiều nhất
      UserCollectionModel.find({ user_id: userId }).sort({ collection_count: -1 }).limit(5).populate('breed_id', 'breed slug')
    ]);

    const totalPredictionsInCollection = totalCountResult[0]?.total || 0;

    return { totalCollected, totalPredictionsInCollection, topBreeds };
  },

  /**
   * Lấy một item trong bộ sưu tập của người dùng bằng slug của giống chó.
   */
  async getCollectionItemBySlug(userId: Types.ObjectId, breedSlug: string) {
    return UserCollectionModel.findOne({ user_id: userId })
      .populate({ path: 'breed_id', match: { slug: breedSlug } })
      .exec()
      .then(result => result && (result as any).breed_id ? result : null);
  },
};