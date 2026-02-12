import { UserCollectionModel, CollectedBreed } from '../models/user_collection.model';
import { getDogBreedWikiModel } from '../models/dogs_wiki.model';
import { PredictionHistoryDoc } from '../models/prediction_history.model';
import { Types } from 'mongoose';

export interface DogDexBreed {
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
}

export const collectionService = {
  /**
   * Thêm hoặc cập nhật nhiều giống chó vào bộ sưu tập của người dùng từ một lần dự đoán.
   */
  async addOrUpdateManyCollections(userId: Types.ObjectId, breedSlugs: string[], predictionId: Types.ObjectId, lang: 'vi' | 'en' = 'en') {
    const uniqueSlugs = [...new Set(breedSlugs)];
    if (uniqueSlugs.length === 0) return;
    const WikiModel = getDogBreedWikiModel(lang);
    const breeds = await WikiModel.find({ slug: { $in: uniqueSlugs } }).select('_id').lean();
    if (breeds.length === 0) return;

    // 1. Ensure document exists (Atomic Upsert)
    await UserCollectionModel.updateOne(
      { user_id: userId },
      { $setOnInsert: { collectedBreeds: [] } },
      { upsert: true }
    );

    // 2. Process each breed atomically (Parallel)
    await Promise.all(breeds.map(async (breed) => {
      const breedId = breed._id;

      // Try to increment existing
      const updateResult = await UserCollectionModel.updateOne(
        { user_id: userId, "collectedBreeds.breed_id": breedId },
        { $inc: { "collectedBreeds.$.collection_count": 1 } }
      );

      // If not found, push new (Atomic Push if not exists)
      if (updateResult.modifiedCount === 0) {
        await UserCollectionModel.updateOne(
          { user_id: userId, "collectedBreeds.breed_id": { $ne: breedId } },
          {
            $push: {
              collectedBreeds: {
                breed_id: breedId,
                first_prediction_id: predictionId,
                collection_count: 1,
              }
            }
          }
        );
      }
    }));
  },

  /**
   * Cập nhật bộ sưu tập từ một mảng các kết quả dự đoán (dành cho batch).
   */
  async addOrUpdateFromPredictionResults(userId: Types.ObjectId, predictionResults: PredictionHistoryDoc[], lang: 'vi' | 'en' = 'en') {
    if (!predictionResults || predictionResults.length === 0) return;

    // 1. Ensure document exists
    await UserCollectionModel.updateOne(
      { user_id: userId },
      { $setOnInsert: { collectedBreeds: [] } },
      { upsert: true }
    );

    const allBreedSlugs = [...new Set(predictionResults.flatMap(p => p.predictions.map(pred => pred.class.toLowerCase().replace(/\s+/g, '-'))))];
    const WikiModel = getDogBreedWikiModel(lang);
    const breedsInDb = await WikiModel.find({ slug: { $in: allBreedSlugs } }).select('_id slug').lean();
    const slugToIdMap = new Map(breedsInDb.map(b => [b.slug, b._id]));
    const operations: { breedId: Types.ObjectId, predictionId: Types.ObjectId }[] = [];

    predictionResults.forEach(prediction => {
      const predictionId = prediction._id;
      const breedSlugs = [...new Set(prediction.predictions.map(p => p.class.toLowerCase().replace(/\s+/g, '-')))];

      breedSlugs.forEach(slug => {
        const breedId = slugToIdMap.get(slug);
        if (breedId) {
          operations.push({ breedId: breedId as Types.ObjectId, predictionId: predictionId as Types.ObjectId });
        }
      });
    });

    // Execute atomic updates in parallel
    await Promise.all(operations.map(async (op) => {
      const { breedId, predictionId } = op;

      const updateResult = await UserCollectionModel.updateOne(
        { user_id: userId, "collectedBreeds.breed_id": breedId },
        { $inc: { "collectedBreeds.$.collection_count": 1 } }
      );

      if (updateResult.modifiedCount === 0) {
        await UserCollectionModel.updateOne(
          { user_id: userId, "collectedBreeds.breed_id": { $ne: breedId } },
          {
            $push: {
              collectedBreeds: {
                breed_id: breedId,
                first_prediction_id: predictionId,
                collection_count: 1,
              }
            }
          }
        );
      }
    }));
  },

  /**
   * Lấy bộ sưu tập ("DogDex") của một người dùng.
   */
  async getUserCollection(userId: Types.ObjectId, lang: 'vi' | 'en' = 'en'): Promise<CollectedBreed[]> {
    const WikiModel = getDogBreedWikiModel(lang);

    const userCollection = await UserCollectionModel.findOne({ user_id: userId, isDeleted: { $ne: true } })
      .populate({
        path: 'collectedBreeds.breed_id',
        model: WikiModel,
        select: 'breed slug group'
      })
      .populate({
        path: 'collectedBreeds.first_prediction_id',
        model: 'PredictionHistory',
        select: 'createdAt source'
      })
      .lean();
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
   * Sắp xếp danh sách DogDex ở tầng ứng dụng.
   */
  sortDogDex(breeds: DogDexBreed[], sortBy: string): DogDexBreed[] {
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
    return breeds;
  },
};