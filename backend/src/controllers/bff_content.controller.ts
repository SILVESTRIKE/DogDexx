// BFF Content Controller
import { Request, Response } from 'express';

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
};
