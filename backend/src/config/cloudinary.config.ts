// src/config/cloudinary.ts
import { v2 as cloudinary } from 'cloudinary';
import CloudinaryStorage = require('multer-storage-cloudinary');
import dotenv from 'dotenv';
import { Request } from 'express';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger.util';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME_CLOUDINARY,
  api_key: process.env.API_KEY_CLOUDINARY,
  api_secret: process.env.API_SECRET_CLOUDINARY,
});

// --- Các hàm helper ---
const getFileTypeDir = (mimetype: string): string => {
  if (mimetype.startsWith("image/")) return "images";
  if (mimetype.startsWith("video/")) return "videos";
  return "others";
};
const getWeekOfMonth = (date: Date): number => {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  const dayOfWeek = startOfMonth.getDay() === 0 ? 6 : startOfMonth.getDay() - 1;
  return Math.ceil((dayOfMonth + dayOfWeek) / 7);
};

// --- Storage Engine cho các file dự đoán (uploads) ---
export const predictionStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req: Request, file: Express.Multer.File) => {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');

    let relativeFolderPath: string;
    if (req.user) {
      const fileTypeDir = getFileTypeDir(file.mimetype);
      relativeFolderPath = path.join("uploads", fileTypeDir, year, month);
    } else {
      const week = `week-${getWeekOfMonth(now)}`;
      relativeFolderPath = path.join("uploads", "test", year, month, week);
    }
    
    const dateString = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}${now.getFullYear()}`;
    const randomChars = crypto.randomBytes(3).toString("hex").slice(0, 5);
    const filenameWithoutExt = `${dateString}_${randomChars}`;

    const publicId = `public/${relativeFolderPath.replace(/\\/g, "/")}/${filenameWithoutExt}`;
    
    return {
      public_id: publicId,
      resource_type: 'auto',
    };
  },
});

export const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req: Request, file: Express.Multer.File) => { // SỬA ĐỔI: Chuyển thành hàm async
    try {
      // SỬA ĐỔI: Chỉ định thư mục, để Cloudinary tự tạo tên file.
      // Điều này giúp quản lý file trong Media Library dễ dàng hơn.
      const folderPath = 'public/uploads/avatars';
      
      const result = {
        folder: folderPath,
        resource_type: 'image', // Avatar luôn là ảnh        
        asset_folder: folderPath
      };

      logger.info('[avatarStorage] Chuẩn bị trả về object cho multer:', result);
      
      return result;

    } catch (error) {
      console.error('[avatarStorage] Lỗi bên trong hàm params:', error);
      throw new Error('Lỗi khi xử lý thông số upload avatar.');
    }
  },
});


export { cloudinary };