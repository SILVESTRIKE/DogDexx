import { MediaModel, MediaDoc } from "../models/medias.model";
import {
  MediaDbZodType,
  UpdateMediaInfoZodSchema,
} from "../types/zod/medias.zod";
import { FilterQuery } from "mongoose";
import { z } from "zod";
import path from 'path';
import { cloudinary } from '../config/cloudinary.config';
import { DirectoryModel } from '../models/directory.model';
import fs from 'fs/promises';
import { logger } from "../utils/logger.util";
export interface FindMediasOptions {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  directory_id?: string | null;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedMediaResult {
  data: MediaDoc[];
  pagination: {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
}

export class MediaService {
  static async createMedia(mediaData: MediaDbZodType): Promise<MediaDoc> {
    return MediaModel.create(mediaData);
  }

  static async updateInfoMedia(
    _id: string,
    data: z.infer<typeof UpdateMediaInfoZodSchema>
  ): Promise<MediaDoc | null> {
    return MediaModel.findOneAndUpdate(
      { _id, isDeleted: false },
      { $set: data },
      { new: true }
    );
  }

  static async softDeleteMedia(_id: string): Promise<MediaDoc | null> {
    const media = await MediaModel.findOneAndUpdate(
      { _id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    return media;
  }

  static async moveMedia(
    mediaId: string,
    newDirectoryId: string | null,
  ): Promise<MediaDoc | null> {
    const media = await MediaModel.findById(mediaId);
    if (!media) {
      return null;
    }

    const oldPublicIdWithExt = media.mediaPath;
    const oldPublicId = oldPublicIdWithExt.substring(0, oldPublicIdWithExt.lastIndexOf('.')) || oldPublicIdWithExt;
    const fileExtension = path.extname(oldPublicIdWithExt);
    const fileName = path.basename(oldPublicId);

    const buildFullPath = async (dirId: string | null): Promise<string> => {
      if (!dirId) return 'public/uploads';
      let current = await DirectoryModel.findById(dirId);
      if (!current) return 'public/uploads';
      let parts = [current.name];
      while (current && current.parent_id) {
        current = await DirectoryModel.findById(current.parent_id);
        if (current) parts.unshift(current.name);
      }
      return `public/uploads/${parts.join('/')}`;
    };

    const newFolderPath = await buildFullPath(newDirectoryId);
    const newPublicId = `${newFolderPath}/${fileName}`;

    if (oldPublicId !== newPublicId) {
      try {
        logger.info(`[Media Service] Moving Cloudinary resource from '${oldPublicId}' to '${newPublicId}' and updating asset_folder.`);
        const renameResult = await cloudinary.uploader.rename(oldPublicId, newPublicId, { overwrite: true });

        await cloudinary.uploader.explicit(renameResult.public_id, {
          type: 'upload',
          asset_folder: newFolderPath
        });
      } catch (error: any) {
        if (error.http_code !== 422) {
          throw error;
        }
        logger.warn(`[Media Service] Destination '${newPublicId}' already exists. Proceeding to update DB record.`);
      }
    }

    media.directory_id = newDirectoryId as any;
    media.mediaPath = `${newPublicId}${fileExtension}`;
    return media.save();
  }

  static async findAndPaginate(
    options: FindMediasOptions
  ): Promise<{ data: MediaDoc[]; pagination: any }> {
    const {
      page = 1,
      limit = 50,
      search,
      type,
      directory_id,
      startDate,
      endDate,
    } = options;

    const filter: any = { isDeleted: false };
    if (directory_id !== undefined) filter.directory_id = directory_id;
    if (search) filter.name = new RegExp(search, "i");
    if (type) filter.type = new RegExp(`^${type}/`, "i");

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00.000Z`);
        if (!isNaN(start.getTime())) {
          filter.createdAt.$gte = start;
        } else {
          throw new Error(
            "Invalid startDate format. Expected format: YYYY-MM-DD"
          );
        }
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999Z`);
        if (!isNaN(end.getTime())) {
          filter.createdAt.$lt = end;
        } else {
          throw new Error(
            "Invalid endDate format. Expected format: YYYY-MM-DD"
          );
        }
      }
    }
    const sortOptions: Record<string, number> = { createdAt: -1 };
    const [totalItems, data] = await Promise.all([
      MediaModel.countDocuments(filter),
      MediaModel.find(filter)
        .sort(sortOptions as any)
        .skip((page - 1) * limit)
        .limit(limit),
    ]);
    const totalPages = Math.ceil(totalItems / limit);
    return {
      data,
      pagination: { totalItems, totalPages, currentPage: page, limit },
    };
  }

  static async findById(id: string): Promise<MediaDoc | null> {
    const result = await MediaModel.findOne({ _id: id, isDeleted: false });
    return result;
  }

  static async getFileTypeFolders(): Promise<string[]> {
    const UPLOADS_DIR = path.join(process.cwd(), "uploads");
    try {
      const entries = await fs.readdir(UPLOADS_DIR, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((d) => d.name);
    } catch {
      return [];
    }
  }

  static async getYearFolders(fileType: string): Promise<string[]> {
    const typePath = path.join(process.cwd(), "uploads", fileType);
    try {
      const entries = await fs.readdir(typePath, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && /^\d{4}$/.test(e.name))
        .map((d) => d.name)
        .sort((a, b) => b.localeCompare(a));
    } catch {
      return [];
    }
  }

  static async getMonthFolders(
    fileType: string,
    year: string
  ): Promise<string[]> {
    const yearPath = path.join(process.cwd(), "uploads", fileType, year);
    try {
      const entries = await fs.readdir(yearPath, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && /^(0[1-9]|1[0-2])$/.test(e.name))
        .map((d) => d.name)
        .sort((a, b) => b.localeCompare(a));
    } catch {
      return [];
    }
  }

  static async findAndPaginateByPhysicalPath(
    fileType: string,
    year: string,
    month: string,
    options: { page?: number; limit?: number; search?: string }
  ): Promise<{ data: MediaDoc[]; pagination: any }> {
    const { page = 1, limit = 50, search } = options;

    const pathRegex = new RegExp(
      `^uploads(\\\\|/)${fileType}(\\\\|/)${year}(\\\\|/)${month}(\\\\|/)`,
      "i"
    );

    const filter: FilterQuery<MediaDoc> = {
      isDeleted: false,
      mediaPath: pathRegex,
    };

    if (search) {
      filter.name = new RegExp(search, "i");
    }

    const sortOptions: Record<string, number> = { createdAt: -1 };

    const [totalItems, data] = await Promise.all([
      MediaModel.countDocuments(filter),
      MediaModel.find(filter)
        .sort(sortOptions as any)
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    const totalPages = Math.ceil(totalItems / limit);
    return {
      data,
      pagination: { totalItems, totalPages, currentPage: page, limit },
    };
  }
}
