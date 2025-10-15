// BFF Content Controller
import { Request, Response } from 'express';
<<<<<<< Updated upstream

export const getBreedDetail = async (req: Request, res: Response) => {
  // TODO: Combine wiki, media, prediction history, collection status
  res.status(501).json({ message: 'Not implemented' });
};

export const getBreeds = async (req: Request, res: Response) => {
  // TODO: Get breeds with filter/sort and collection status
  res.status(501).json({ message: 'Not implemented' });
};

export const uploadMedia = async (req: Request, res: Response) => {
  // TODO: Upload media, create directory if needed, return URL and metadata
  res.status(501).json({ message: 'Not implemented' });
=======
import { wikiService } from '../services/dogs_wiki.service';
import { UserCollectionModel } from '../models/user_collection.model';
import { MediaModel } from '../models/medias.model';
import { transformMediaURLs } from '../utils/media.util';

export const getBreedDetail = async (req: Request, res: Response) => {
  const { slug } = req.params;
  const userId = req.user?._id;

  // 1. Get breed info from wiki
  const breed = await wikiService.getBreedBySlug(slug);

  let collectionStatus = { collected: false, count: 0 };
  if (userId) {
    // 2. If user is logged in, get their collection status for this breed
    const userCollection = await UserCollectionModel.findOne({ user_id: userId, breed_id: breed._id });
    if (userCollection) {
      collectionStatus = {
        collected: true,
        count: userCollection.collection_count,
      };
    }
  }

  // 3. (Optional) Get related media from prediction history
  // This can be a more complex query, for now we return the basic combined data.

  res.status(200).json({
    message: "Lấy chi tiết giống chó thành công.",
    data: {
      ...breed.toObject(),
      collection_status: collectionStatus,
    }
  });
};

export const getBreeds = async (req: Request, res: Response) => {
  // This endpoint is very similar to `getPokedex`. We can reuse the logic or point to it.
  // For simplicity, we'll just call the existing wiki service.
  // The frontend can call `/bff/collection/pokedex` for the enriched version.
  const { getAll } = require('./dogs_wiki.controller');
  return getAll(req, res);
};

export const uploadMedia = async (req: Request, res: Response) => {
  // This is a core function, better handled by the existing medias.controller
  const { uploadSingle } = require('./medias.controller');
  return uploadSingle(req, res);
>>>>>>> Stashed changes
};
