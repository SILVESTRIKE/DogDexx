import { MediaModel, MediaDoc } from "../models/medias.model";
import {
  MediaDbZodType,
  UpdateMediaInfoZodSchema,
} from "../types/zod/medias.zod";
import { FilterQuery } from "mongoose";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from 'uuid';

export interface FindMediasOptions {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  directory_id?: string | null;
  startDate?: string; // Định dạng YYYY-MM-DD
  endDate?: string; // Định dạng YYYY-MM-DD
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
    _id: number,
    data: z.infer<typeof UpdateMediaInfoZodSchema>
  ): Promise<MediaDoc | null> {
    return MediaModel.findByIdAndUpdate(
      { _id, isDeleted: false },
      { $set: data },
      { new: true }
    );
  }

  static async softDeleteMedia(_id: number): Promise<MediaDoc | null> {
    const media = await MediaModel.findByIdAndUpdate(
      _id,
      { isDeleted: true },
      { new: true }
    );
    return media;
  }

  /**
   * Di chuyển một media sang một thư mục logic khác, đồng thời di chuyển file vật lý.
   * @param mediaId ID của media cần di chuyển.
   * @param newDirectoryId ID của thư mục đích (có thể là null để chuyển ra thư mục gốc).
   * @returns Media đã được cập nhật hoặc null nếu không tìm thấy.
   */
  static async moveMedia(
    mediaId: string,
    newDirectoryId: string | null
  ): Promise<MediaDoc | null> {
    const media = await MediaModel.findById(mediaId);
    if (!media) {
      return null;
    }

    const oldPath = path.resolve(media.mediaPath);

    // Tạo đường dẫn vật lý mới dựa trên ngày hiện tại
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const fileExtension = path.extname(media.mediaPath);
    const newFilename = `${uuidv4()}${fileExtension}`;
    
    // Giả định thư mục upload có cấu trúc uploads/<type>/<year>/<month>
    // media.type có thể là 'image/jpeg', ta chỉ cần 'image'
    const mediaTypeFolder = media.type ? media.type.split('/')[0] : 'unknown';
    const newDir = path.join(process.cwd(), 'uploads', mediaTypeFolder, year, month);
    const newPath = path.join(newDir, newFilename);
    const newRelativePath = path.join('uploads', mediaTypeFolder, year, month, newFilename).replace(/\\/g, '/');

    // Đảm bảo thư mục đích tồn tại
    await fs.mkdir(newDir, { recursive: true });

    // Di chuyển file vật lý
    await fs.rename(oldPath, newPath);

    // Cập nhật lại media trong DB
    media.directory_id = newDirectoryId as any;
    media.mediaPath = newRelativePath;
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
      filter.created_date = {};
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00.000Z`);
        if (!isNaN(start.getTime())) {
          filter.created_date.$gte = start;
        } else {
          throw new Error(
            "Invalid startDate format. Expected format: YYYY-MM-DD"
          );
        }
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999Z`);
        if (!isNaN(end.getTime())) {
          filter.created_date.$lt = end;
        } else {
          throw new Error(
            "Invalid endDate format. Expected format: YYYY-MM-DD"
          );
        }
      }
    }
    const sortOptions: Record<string, number> = { created_date: -1 };
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

  static async findById(id: number): Promise<MediaDoc | null> {
    const result = await MediaModel.findOne({ _id: id, isDeleted: false });
    return result;
  }

  // --- CÁC HÀM TRUY XUẤT VẬT LÝ ---
  static async getFileTypeFolders(): Promise<string[]> {
    const UPLOADS_DIR = path.join(process.cwd(), "uploads");
    try {
      const entries = await fs.readdir(UPLOADS_DIR, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((d) => d.name);
    } catch {
      return [];
    }
  }

  /**
   * Lấy danh sách các thư mục năm trong một thư mục loại file.
   */
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

  /**
   * Lấy danh sách các thư mục tháng trong một thư mục năm/loại file.
   */
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

    const sortOptions: Record<string, number> = { created_date: -1 };

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
