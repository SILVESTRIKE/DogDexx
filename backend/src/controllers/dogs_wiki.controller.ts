import { Request, Response } from 'express';
import { wikiService, QueryOptions } from '../services/dogs_wiki.service';
import { transformMediaURLs } from '../utils/media.util';

export const wikiController = {
  // === PUBLIC ROUTES ===
  async getBySlug(req: Request, res: Response) {
    const data = await wikiService.getBreedBySlug(req.params.slug);
    res.status(200).json({ data: transformMediaURLs(req, data) });
  },
  
  async getAll(req: Request, res: Response) {
    const options = {
      page: parseInt(req.query.page as string, 10) || 1,
      limit: parseInt(req.query.limit as string, 10) || 20,
      search: req.query.search as string,
      // Thêm các bộ lọc mới
      group: req.query.group as string | undefined,
      energy_level: req.query.energy_level ? parseInt(req.query.energy_level as string, 10) : undefined,
      trainability: req.query.trainability ? parseInt(req.query.trainability as string, 10) : undefined,
      shedding_level: req.query.shedding_level ? parseInt(req.query.shedding_level as string, 10) : undefined,
      suitable_for: req.query.suitable_for as string | undefined,
    } as QueryOptions;
    // Xóa các key có giá trị undefined để không gửi chúng đến service
    Object.keys(options).forEach(key => options[key as keyof typeof options] === undefined && delete options[key as keyof typeof options]);
    const paginatedResult = await wikiService.getAllBreeds(options);
    // Chuyển đổi URL cho mảng data
    paginatedResult.data = transformMediaURLs(req, paginatedResult.data);
    res.status(200).json(paginatedResult);
  },

  // === ADMIN ROUTES ===
  async create(req: Request, res: Response) {
    const newBreed = await wikiService.createBreed(req.body);
    res.status(201).json({ message: 'Thêm giống chó mới thành công.', data: newBreed });
  },

  async update(req: Request, res: Response) {
    const updatedBreed = await wikiService.updateBreed(req.params.slug, req.body);
    res.status(200).json({ message: 'Cập nhật thông tin thành công.', data: updatedBreed });
  },

  async softDelete(req: Request, res: Response) {
    const result = await wikiService.softDeleteBreed(req.params.slug);
    res.status(200).json(result);
  },
};