import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { wikiService } from '../services/dogs_wiki.service';
import { transformMediaURLs } from '../utils/media.util';
import { wikiController } from './dogs_wiki.controller';
import { collectionService } from '../services/user_collections.service';
import { predictionHistoryService } from '../services/prediction_history.service';
import { MediaController } from './medias.controller';

export const getBreedDetail = async (req: Request, res: Response, next: NextFunction) => {
  const { slug } = req.params;
  const userId = req.user?._id;

  // 1. Get breed info, collection status, and related media in parallel
  const [breed, userCollection, relatedMedia] = await Promise.all([
    wikiService.getBreedBySlug(slug),
    userId ? collectionService.getCollectionItemBySlug(userId, slug) : Promise.resolve(null),
    predictionHistoryService.findHistoriesByBreedName(slug, 10)
  ]);

  // 2. Format the response
  const collectionStatus = {
    isCollected: !!userCollection,
    // Lấy createdAt từ first_prediction_id đã được populate
    collectedAt: (userCollection?.first_prediction_id as any)?.createdAt || null,
  };

  // Correctly transform the array of related media objects
  const transformedMedia = transformMediaURLs(req, relatedMedia).map((m: any) => ({
    url: m.processedMediaUrl, // Use the correct transformed property name
    type: 'image'
  }));

  res.status(200).json({
    breed: transformMediaURLs(req, breed.toObject()), // Chuyển đổi URL cho breed chính
    collectionStatus,
    media: transformedMedia,
  });
};

export const getBreeds = (req: Request, res: Response, next: NextFunction) => {
  // This endpoint is very similar to `getPokedex`. We can reuse the logic or point to it.
  // For simplicity, we'll just call the existing wiki service.
  // The frontend should call `/bff/collection/pokedex` for the enriched version.
  return wikiController.getAll(req, res);
};

export const uploadMedia = (req: Request, res: Response, next: NextFunction) => {
  // This is a core function, better handled by the existing medias.controller.
  return MediaController.uploadSingle(req, res);
};
