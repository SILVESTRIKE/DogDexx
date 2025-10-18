import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Request } from "express";

const PUBLIC_DIR = "public";
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR);
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

    if (req.user) {
      // Logged-in user
      const fileTypeDir = getFileTypeDir(file.mimetype);
      fullPath = path.join(UPLOADS_DIR, fileTypeDir, year, month);
    } else {
      // Anonymous user
      const week = `week-${getWeekOfMonth(now)}`;
      fullPath = path.join(UPLOADS_DIR, "test", year, month, week);
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

    // Lấy đường dẫn thư mục đích đã được lưu từ hàm `destination`
    const destination = (req as any).uploadDestinationPath;
    if (destination) {
      const relativePath = path.relative(PUBLIC_DIR, destination);
      (file as any).path = path.join('/', relativePath, newFilename).replace(/\\/g, '/');
    }
  },
});

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "application/pdf",
];

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Định dạng file không được hỗ trợ!"));
  }
};
const multerOptions = {
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 1024 * 1024 * 20 },
};

export const uploadSingle = multer(multerOptions).single("file");
export const uploadMultiple = multer(multerOptions).array("files", 10);
