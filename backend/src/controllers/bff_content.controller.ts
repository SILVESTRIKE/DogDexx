import { Request, Response } from 'express';
import { wikiService } from '../services/dogs_wiki.service';
import { UserCollectionModel } from '../models/user_collection.model';
import { transformMediaURLs } from '../utils/media.util';
import { PredictionHistoryModel } from '../models/prediction_history.model';
import { wikiController } from './dogs_wiki.controller';

export const getBreedDetail = async (req: Request, res: Response) => {
  const { slug } = req.params;
  const userId = req.user?._id;

  // 1. Get breed info, collection status, and related media in parallel
  const [breed, userCollection, relatedMedia] = await Promise.all([
    wikiService.getBreedBySlug(slug),
    userId ? UserCollectionModel.findOne({ user_id: userId, 'breed_id.slug': slug }) : Promise.resolve(null),
    PredictionHistoryModel.find({ 'predictions.class': { $regex: new RegExp(slug.replace(/-/g, ' '), 'i') } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('processedMediaPath')
  ]);

  // 2. Format the response
  const collectionStatus = {
    isCollected: !!userCollection,
    collectedAt: userCollection?.first_collected_at || null,
  };

  const transformedMedia = relatedMedia.map(m => ({
    url: transformMediaURLs(req, m).processedMediaPath,
    type: 'image' // Assuming all are images for now
  }));

  res.status(200).json({
    breed: breed.toObject(), // toObject() to get a plain JS object
    collectionStatus,
    media: transformedMedia,
  });
};

export const getBreeds = async (req: Request, res: Response) => {
  // This endpoint is very similar to `getPokedex`. We can reuse the logic or point to it.
  // For simplicity, we'll just call the existing wiki service.
  // The frontend should call `/bff/collection/pokedex` for the enriched version.
  return wikiController.getAll(req, res);
};

export const uploadMedia = async (req: Request, res: Response) => {
  // This is a core function, better handled by the existing medias.controller.
  const { uploadSingle } = require('./medias.controller');
  return uploadSingle(req, res);
};
