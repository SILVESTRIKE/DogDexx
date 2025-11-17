// src/middleware/upload.middleware.ts
import multer from "multer";
import { Request } from "express";
// Import các storage engine từ file config
// THAY ĐỔI: Chỉ import avatarStorage, predictionStorage sẽ được thay thế bằng memoryStorage
import { avatarStorage } from "../config/cloudinary.config";
 
// --- Các bộ lọc file (giữ nguyên) ---
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
    if (file.mimetype.startsWith("image/")) (req as any).mediaType = "image";
    else (req as any).mediaType = "video";
    cb(null, true);
  } else {
    cb(new Error("Định dạng file không được hỗ trợ!"));
  }
};
const avatarFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ hỗ trợ định dạng file ảnh cho avatar!"));
  }
};

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 10;

// --- Cập nhật các export để dùng storage mới ---
export const uploadSingle = multer({
  storage: multer.memoryStorage(), // <--- THAY ĐỔI: Dùng memoryStorage để có file.buffer
  fileFilter: fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single("file");

export const uploadMultiple = multer({
  storage: multer.memoryStorage(), // <--- THAY ĐỔI: Dùng memoryStorage cho cả batch
  fileFilter: fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
}).array("files", MAX_FILES);

export const uploadAvatar = multer({
  storage: avatarStorage, // <--- THAY ĐỔI
  fileFilter: avatarFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("avatar");

// Upload model vẫn dùng memoryStorage là đúng
export const uploadModelFiles = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
}).single('modelFile');