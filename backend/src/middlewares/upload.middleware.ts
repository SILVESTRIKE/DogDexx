import multer from "multer";
import { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { validateFileMagicBytes, validateMultipleFiles } from "../utils/file-validation.util";

// Ensure temp directory exists
const TEMP_UPLOAD_DIR = path.join(__dirname, "../../public/uploads/temp");
if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}

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

// Health records cần hỗ trợ thêm PDF
const healthRecordFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Chỉ hỗ trợ file ảnh hoặc PDF cho hồ sơ sức khỏe!"));
  }
};

const avatarFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ hỗ trợ định dạng file ảnh cho avatar!"));
  }
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB cho video
const MAX_FILES = 10;

// Configure Disk Storage
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

/**
 * Middleware wrapper để validate magic bytes sau khi upload
 * Đảm bảo file thực sự đúng định dạng, không bị giả mạo MIME type
 */
function withMagicBytesValidation(uploadMiddleware: any) {
  return function (req: Request, res: Response, next: NextFunction) {
    uploadMiddleware(req, res, function (err: any) {
      if (err) {
        return next(err);
      }

      // Validate single file
      if (req.file) {
        if (!validateFileMagicBytes(req.file.path, req.file.mimetype)) {
          // Xóa file giả mạo
          try {
            fs.unlinkSync(req.file.path);
          } catch { /* ignore */ }

          return res.status(400).json({
            message: 'File không hợp lệ. Định dạng file không khớp với nội dung thực tế.',
            code: 'INVALID_FILE_FORMAT'
          });
        }
      }

      // Validate multiple files
      if (req.files && Array.isArray(req.files)) {
        const validation = validateMultipleFiles(req.files as Express.Multer.File[]);

        if (!validation.isValid) {
          return res.status(400).json({
            message: `Một hoặc nhiều file không hợp lệ: ${validation.invalidFiles.join(', ')}`,
            code: 'INVALID_FILE_FORMAT',
            invalidFiles: validation.invalidFiles
          });
        }
      }

      next();
    });
  };
}

// --- Tạo multer instances gốc ---
const _uploadSingle = multer({
  storage: diskStorage,
  fileFilter: fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single("file");

const _uploadMultiple = multer({
  storage: diskStorage,
  fileFilter: fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
}).array("files", MAX_FILES);

const _uploadHealthRecords = multer({
  storage: diskStorage,
  fileFilter: healthRecordFileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_FILES }, // 10MB cho health records
}).array("files", MAX_FILES);

const _uploadAvatar = multer({
  storage: multer.memoryStorage(),
  fileFilter: avatarFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("avatar");

const _uploadModelFiles = multer({
  storage: diskStorage,
  limits: { fileSize: 500 * 1024 * 1024 },
}).single('modelFile');

// --- Export với magic bytes validation ---
export const uploadSingle = withMagicBytesValidation(_uploadSingle);
export const uploadMultiple = withMagicBytesValidation(_uploadMultiple);
export const uploadHealthRecords = withMagicBytesValidation(_uploadHealthRecords);

// Avatar dùng memory storage nên không cần validate magic bytes (sẽ phải validate khác)
export const uploadAvatar = _uploadAvatar;

// Model files không cần validate magic bytes
export const uploadModelFiles = _uploadModelFiles;
