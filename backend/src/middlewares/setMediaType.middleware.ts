import { Request, Response, NextFunction } from "express";
import { BadRequestError } from "../errors";

/**
 * Middleware để tự động phát hiện và gán mediaType vào request
 * từ file đã được upload bởi multer.
 */
export const setMediaType = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Kiểm tra nếu có file (từ multer)
    if (req.file) {
      const mimeType = req.file.mimetype;
      if (mimeType.startsWith("image/")) {
        (req as any).mediaType = "image";
      } else if (mimeType.startsWith("video/")) {
        (req as any).mediaType = "video";
      } else {
        return next(new BadRequestError("Định dạng file không được hỗ trợ."));
      }
    } else {
      return next(new BadRequestError("Không tìm thấy file."));
    }
    next();
  };
};