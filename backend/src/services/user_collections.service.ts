import { UserCollectionModel, CollectedBreed } from '../models/user_collection.model';
import { getDogBreedWikiModel } from '../models/dogs_wiki.model';
import { PredictionHistoryDoc } from '../models/prediction_history.model';
import { Types } from 'mongoose';
import { PokedexBreed } from '../controllers/bff_collection.controller';

export const collectionService = {
  /**
   * Thêm hoặc cập nhật nhiều giống chó vào bộ sưu tập của người dùng từ một lần dự đoán.
   * @param userId ID của người dùng
   * @param breedSlugs Mảng các slug của giống chó
   * @param predictionId ID của bản ghi lịch sử dự đoán đã phát hiện ra các giống chó này
   */
  async addOrUpdateManyCollections(userId: Types.ObjectId, breedSlugs: string[], predictionId: Types.ObjectId, lang: 'vi' | 'en' = 'en') {
    const uniqueSlugs = [...new Set(breedSlugs)];
    // SỬA LỖI: Sử dụng model theo ngôn ngữ để tìm breed_id
    const WikiModel = getDogBreedWikiModel(lang);
    const breeds = await WikiModel.find({ slug: { $in: uniqueSlugs } }).select('_id').lean();
    if (breeds.length === 0) return;

    const breedIds = breeds.map(b => b._id);

    // Find the user's single collection document, or create it if it doesn't exist.
    let userCollection = await UserCollectionModel.findOne({ user_id: userId });
    if (!userCollection) {
      userCollection = new UserCollectionModel({ user_id: userId, collectedBreeds: [] });
    }

    breedIds.forEach(breedId => {
      const existingBreedIndex = userCollection!.collectedBreeds.findIndex(cb => cb.breed_id.toString() === breedId.toString());

      if (existingBreedIndex > -1) {
        // Breed already exists, just increment the count
        userCollection!.collectedBreeds[existingBreedIndex].collection_count++;
      } else {
        // New breed, add it to the array
        userCollection!.collectedBreeds.push({
          breed_id: breedId as Types.ObjectId,
          first_prediction_id: predictionId as Types.ObjectId,
          collection_count: 1,
        });
      }
    });

    await userCollection.save();
  },

  /**
   * [MỚI & TỐI ƯU] Cập nhật bộ sưu tập từ một mảng các kết quả dự đoán (dành cho batch).
   * @param userId ID của người dùng
   * @param predictionResults Mảng các document PredictionHistory
   */
  async addOrUpdateFromPredictionResults(userId: Types.ObjectId, predictionResults: PredictionHistoryDoc[], lang: 'vi' | 'en' = 'en') {
    if (!predictionResults || predictionResults.length === 0) return;

    let userCollection = await UserCollectionModel.findOne({ user_id: userId });
    if (!userCollection) {
      userCollection = new UserCollectionModel({ user_id: userId, collectedBreeds: [] });
    }
    
    const allBreedSlugs = [...new Set(predictionResults.flatMap(p => p.predictions.map(pred => pred.class.toLowerCase().replace(/\s+/g, '-'))))];
    // SỬA LỖI: Sử dụng model theo ngôn ngữ
    const WikiModel = getDogBreedWikiModel(lang);
    const breedsInDb = await WikiModel.find({ slug: { $in: allBreedSlugs } }).select('_id slug').lean();
    const slugToIdMap = new Map(breedsInDb.map(b => [b.slug, b._id]));

    predictionResults.forEach(prediction => {
      const predictionId = prediction._id;
      const breedSlugs = [...new Set(prediction.predictions.map(p => p.class.toLowerCase().replace(/\s+/g, '-')))];

      breedSlugs.forEach(slug => {
        const breedId = slugToIdMap.get(slug);
        if (breedId) {
          const existingBreedIndex = userCollection!.collectedBreeds.findIndex(cb => cb.breed_id.toString() === breedId.toString());
          if (existingBreedIndex > -1) {
            userCollection!.collectedBreeds[existingBreedIndex].collection_count++;
          } else {
            userCollection!.collectedBreeds.push({
              breed_id: breedId as Types.ObjectId,
              first_prediction_id: predictionId as Types.ObjectId,
              collection_count: 1,
            });
          }
        }
      });
    });

    await userCollection.save();
  },

  /**
   * Thêm hoặc cập nhật một giống chó vào bộ sưu tập (thường dùng cho 'manual_add').
   * Chức năng này cần được thiết kế lại vì không có predictionId.
   * Tạm thời, chúng ta sẽ không triển khai chức năng này.
   */
  async addOrUpdateCollection(userId: Types.ObjectId, breedSlug: string) {
    console.warn("addOrUpdateCollection (manual add) is not supported in the new schema that requires a predictionId.");
    // Trả về null để controller biết rằng chức năng này không được hỗ trợ
    return null;
  },

  /**
   * Lấy bộ sưu tập ("Pokedex") của một người dùng.
   */
  async getUserCollection(userId: Types.ObjectId, lang: 'vi' | 'en' = 'en'): Promise<CollectedBreed[]> {
    const WikiModel = getDogBreedWikiModel(lang);

    const userCollection = await UserCollectionModel.findOne({ user_id: userId, isDeleted: { $ne: true } })
      .populate({
        path: 'collectedBreeds.breed_id',
        model: WikiModel, // SỬA LỖI: Sử dụng model động theo ngôn ngữ
        select: 'breed slug group' // Lấy các trường cần thiết
      })
      .populate({
        path: 'collectedBreeds.first_prediction_id',
        model: 'PredictionHistory',
        select: 'createdAt source' // Lấy ngày và nguồn từ prediction
      })
      .lean(); // Sử dụng lean() để tăng hiệu suất
    return userCollection ? userCollection.collectedBreeds : [];
  },

  /**
   * Lấy các thống kê về bộ sưu tập của người dùng.
   */
  async getCollectionStats(userId: Types.ObjectId) {
    const userCollection = await UserCollectionModel.findOne({ user_id: userId, isDeleted: { $ne: true } }).populate('collectedBreeds.breed_id', 'breed slug').lean();
    if (!userCollection) {
      return { totalCollected: 0, totalPredictionsInCollection: 0, topBreeds: [] };
    }

    const totalCollected = userCollection.collectedBreeds.length;
    const totalPredictionsInCollection = userCollection.collectedBreeds.reduce((sum, b) => sum + b.collection_count, 0);
    const topBreeds = [...userCollection.collectedBreeds]
      .sort((a, b) => b.collection_count - a.collection_count)
      .slice(0, 5)
      .map(b => ({ breed: (b.breed_id as any).breed, slug: (b.breed_id as any).slug, count: b.collection_count }));

    return { totalCollected, totalPredictionsInCollection, topBreeds };
  },

  /**
   * Lấy một item trong bộ sưu tập của người dùng bằng slug của giống chó.
   */
  async getCollectionItemBySlug(userId: Types.ObjectId, breedSlug: string, lang: 'vi' | 'en' = 'en') {
    const WikiModel = getDogBreedWikiModel(lang);
    const breed = await WikiModel.findOne({ slug: breedSlug }).select('_id').lean();
    if (!breed) return null;

    const userCollection = await UserCollectionModel.findOne({ user_id: userId, isDeleted: { $ne: true }, 'collectedBreeds.breed_id': breed._id })
      .populate('collectedBreeds.first_prediction_id', 'createdAt source')
      .lean();

    return userCollection ? userCollection.collectedBreeds.find(cb => (cb.breed_id as any)?._id?.toString() === breed._id.toString()) : null;
  },

  /**
   * Sắp xếp danh sách Pokedex ở tầng ứng dụng, đặc biệt cho các trường không có trong DB.
   * @param breeds Mảng các giống chó đã được làm giàu.
   * @param sortBy Chuỗi sắp xếp (ví dụ: 'collectedAt-desc').
   * @returns Mảng đã được sắp xếp.
   */
  sortPokedex(breeds: PokedexBreed[], sortBy: string): PokedexBreed[] {
    if (sortBy === 'collectedAt-desc') {
      return breeds.sort((a, b) => {
        if (!a.collectedAt) return 1;
        if (!b.collectedAt) return -1;
        return new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime();
      });
    }
    if (sortBy === 'collectedAt-asc') {
      return breeds.sort((a, b) => {
        if (!a.collectedAt) return 1;
        if (!b.collectedAt) return -1;
        return new Date(a.collectedAt).getTime() - new Date(b.collectedAt).getTime();
      });
    }
    return breeds; // Trả về mảng gốc nếu không có tùy chọn sắp xếp phù hợp
  },
};