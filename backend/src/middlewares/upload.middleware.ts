import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Request } from "express";
import { AVATAR_UPLOAD_DIR, MEDIA_UPLOAD_DIR } from "../constants/paths.constants";

const getFileTypeDir = (mimetype: string): string => {
  // Chỉ xử lý các loại file ảnh cho avatar
  if (mimetype.startsWith("image/")) return "images";
  if (mimetype.startsWith("video/")) return "videos";
  if (mimetype.startsWith("audio/")) return "audios";
  if (mimetype === "application/pdf") return "documents";
  return "others";
};

const getWeekOfMonth = (date: Date) => {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  // Adjust for Sunday being 0
  const dayOfWeek = startOfMonth.getDay() === 0 ? 6 : startOfMonth.getDay() - 1;
  return Math.ceil((dayOfMonth + dayOfWeek) / 7);
};

// --- Storage cho các file dự đoán ---
const predictionStorage = multer.diskStorage({
  /**
   * Cấu hình nơi lưu file theo cấu trúc: uploads/TYPE/YYYY/MM
   */
  destination: (req: Request, file, cb) => {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");

    let fullPath: string;

    if (req.user) {
      // Logged-in user
      const fileTypeDir = getFileTypeDir(file.mimetype);
      fullPath = path.join(MEDIA_UPLOAD_DIR, fileTypeDir, year, month);
    } else {
      // Anonymous user
      const week = `week-${getWeekOfMonth(now)}`;
      fullPath = path.join(MEDIA_UPLOAD_DIR, "test", year, month, week);
    }

    fs.mkdirSync(fullPath, { recursive: true });

    // Lưu đường dẫn thư mục đích vào request để có thể sử dụng lại trong hàm `filename`
    (req as any).uploadDestinationPath = fullPath;

    cb(null, fullPath);
  },

  filename: (req, file, cb) => {
    const now = new Date();
    const dateString = `${String(now.getDate()).padStart(2, "0")}${String(
      now.getMonth() + 1
    ).padStart(2, "0")}${now.getFullYear()}`;
    const randomChars = crypto.randomBytes(3).toString("hex").slice(0, 5);
    const extension = path.extname(file.originalname);
    const newFilename = `${dateString}_${randomChars}${extension}`;
    cb(null, newFilename);
  },
});

// --- Storage cho avatar người dùng ---
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fullPath = AVATAR_UPLOAD_DIR;
    fs.mkdirSync(fullPath, { recursive: true });
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    // Tạo tên file duy nhất để tránh ghi đè: userId_timestamp.ext
    const userId = req.user?._id || "temp";
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const newFilename = `${userId}_${timestamp}${extension}`;
    cb(null, newFilename);
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Cho phép cả ảnh và video cho các route dự đoán
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
    // Gán mediaType đã được thực hiện trong middleware setMediaType,
    // nhưng chúng ta có thể để ở đây để dự phòng hoặc xóa đi nếu setMediaType luôn chạy trước.
    // Để an toàn, cứ giữ lại.
    if (file.mimetype.startsWith("image/")) (req as any).mediaType = "image";
    else (req as any).mediaType = "video";
    cb(null, true);
  } else {
    cb(new Error("Định dạng file không được hỗ trợ!"));
  }
};

const avatarFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Chỉ cho phép file ảnh cho avatar
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ hỗ trợ định dạng file ảnh cho avatar!"));
  }
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 10; // Maximum number of files in a single upload

const multerOptions = {
  storage: predictionStorage,
  fileFilter: fileFilter,
  limits: { 
    fileSize: MAX_FILE_SIZE,
  },
};

const multerMultipleOptions = {
  ...multerOptions,
  limits: {
    ...multerOptions.limits,
    files: MAX_FILES,
  },
};

export const uploadSingle = multer(multerOptions).single("file");
export const uploadMultiple = multer(multerMultipleOptions).array("files", MAX_FILES);

// Middleware mới cho việc upload avatar
export const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: avatarFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB cho avatar
}).single("avatar");


// Middleware mới cho việc upload model
export const uploadModelFiles = multer({
  storage: multer.memoryStorage(), // Lưu file vào bộ nhớ đệm thay vì ghi ra đĩa
  limits: {
    fileSize: 500 * 1024 * 1024, // Tăng giới hạn lên 500MB cho file model
  }
}).fields([{ name: 'modelFile', maxCount: 1 }]);
