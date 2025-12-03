import { Request, Response, NextFunction } from 'express';
import { wikiService } from '../services/dogs_wiki.service';
import { transformMediaURLs } from '../utils/media.util';
import { wikiController } from './dogs_wiki.controller';
import { collectionService } from '../services/user_collections.service';
import { predictionHistoryService } from '../services/prediction_history.service';
import { logger } from '../utils/logger.util';
import { MediaController, DirectoryController } from './medias.controller';
import { NotFoundError } from '../errors';

export const getBreedDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const userId = req.user?._id;
    const lang = (req.query.lang === 'vi' || req.query.lang === 'en') ? req.query.lang as 'vi' | 'en' : 'en';
    logger.info(`[BFF BreedDetail] Language for slug '${slug}' resolved to '${lang}' from query param.`);

    const [breed, userCollection, relatedMedia] = await Promise.all([
      wikiService.getBreedBySlug(slug, lang),
      userId ? collectionService.getCollectionItemBySlug(userId, slug, lang) : Promise.resolve(null),
      predictionHistoryService.findHistoriesByBreedName(slug, 10)
    ]);

    if (!breed) {
      return next(new NotFoundError(`Không tìm thấy giống chó với slug: '${slug}'`));
    }

    const collectionStatus = {
      isCollected: !!userCollection,
      collectedAt: (userCollection?.first_prediction_id as any)?.createdAt || null,
    };

    const transformedMedia = transformMediaURLs(req, relatedMedia).map((m: any) => ({
      url: m.processedMediaUrl,
      type: 'image'
    }));

    res.status(200).json({
      breed: transformMediaURLs(req, breed.toObject()),
      collectionStatus,
      media: transformedMedia,
    });
  } catch (error) {
    next(error);
  }
};

export const getBreeds = (req: Request, res: Response) => {
  return wikiController.getAll(req, res);
};

export const uploadMedia = (req: Request, res: Response) => {
  return MediaController.uploadSingle(req, res);
};

export const listMedia = (req: Request, res: Response) => {
  return MediaController.getMedias(req, res);
};

export const getMediaById = (req: Request, res: Response) => {
  return MediaController.getMediaById(req, res);
};

export const updateMedia = (req: Request, res: Response) => {
  return MediaController.updateMediaInfo(req, res);
};

export const deleteMedia = (req: Request, res: Response) => {
  return MediaController.deleteMedia(req, res);
};

export const createDirectory = (req: Request, res: Response) => {
  return DirectoryController.create(req, res);
};

export const getDirectories = (req: Request, res: Response) => {
  return DirectoryController.getAll(req, res);
};

export const getDirectoryContent = (req: Request, res: Response) => {
  return DirectoryController.getContent(req, res);
};

export const renameDirectory = (req: Request, res: Response) => {
  return DirectoryController.rename(req, res);
};

export const moveDirectory = (req: Request, res: Response) => {
  return DirectoryController.move(req, res);
};

export const deleteDirectory = (req: Request, res: Response) => {
  return DirectoryController.softDelete(req, res);
};