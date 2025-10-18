import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Request } from "express";

const UPLOADS_DIR = "uploads";

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}
const getFileTypeDir = (mimetype: string): string => {
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

const storage = multer.diskStorage({
  /**
   * Cấu hình nơi lưu file theo cấu trúc: uploads/TYPE/YYYY/MM
   */
  destination: (req: Request, file, cb) => {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");

    let fullPath: string;

    if (req.user && req.user.isGuest !== true) {
      // Logged-in user
      const fileTypeDir = getFileTypeDir(file.mimetype);
      fullPath = path.join(UPLOADS_DIR, fileTypeDir, year, month);
    } else {
      // Anonymous user
      const week = `week-${getWeekOfMonth(now)}`;
      fullPath = path.join(UPLOADS_DIR, "test", year, month, week);
    }

    fs.mkdirSync(fullPath, { recursive: true });

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

const allowedMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/avi",
  "video/webm",
  "video/mov",
  "video/mkv",
  "application/pdf",
];

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    // Tự động phát hiện và gán loại media
    if (file.mimetype.startsWith("image/")) {
      (req as any).mediaType = "image";
    } else if (file.mimetype.startsWith("video/")) {
      (req as any).mediaType = "video";
    }
    cb(null, true);
  } else {
    cb(new Error("Định dạng file không được hỗ trợ!"));
  }
};
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 10; // Maximum number of files in a single upload

const multerOptions = {
  storage: storage,
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
