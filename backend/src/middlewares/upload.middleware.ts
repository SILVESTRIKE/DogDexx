import multer from "multer";
import { Request } from "express";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const TEMP_UPLOAD_DIR = path.join(__dirname, "../../public/uploads/temp");
if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}
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

const MAX_FILE_SIZE = 50 * 1024 * 1024; // Tăng lên 50MB cho video
const MAX_FILES = 10;

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

export const uploadSingle = multer({
  storage: diskStorage,
  fileFilter: fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single("file");

export const uploadMultiple = multer({
  storage: diskStorage,
  fileFilter: fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
}).array("files", MAX_FILES);

export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  fileFilter: avatarFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("avatar");
export const uploadModelFiles = multer({
  storage: diskStorage,
  limits: { fileSize: 500 * 1024 * 1024 },
}).single('modelFile');