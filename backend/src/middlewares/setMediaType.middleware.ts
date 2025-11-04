import { Request, Response, NextFunction } from "express";
import { BadRequestError } from "../errors";

/**
 * Middleware để tự động phát hiện và gán mediaType vào request
 * từ file đã được upload bởi multer.
 */
export const setMediaType = (mode: 'single' | 'multiple' = 'single') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const files = req.files as Express.Multer.File[];
    const file = req.file;

    if (mode === 'single' && file) {
      const mimeType = file.mimetype;
      if (mimeType.startsWith("image/")) {
        (req as any).mediaType = "image";
      } else if (mimeType.startsWith("video/")) {
        (req as any).mediaType = "video";
      } else {
        return next(new BadRequestError("Định dạng file đơn không được hỗ trợ."));
      }
    } else if (mode === 'multiple' && Array.isArray(files) && files.length > 0) {
      // Đối với batch, chúng ta giả định tất cả đều là ảnh.
      // Logic này có thể được làm phức tạp hơn nếu cần hỗ trợ batch video.
      if (files.every(f => f.mimetype.startsWith("image/"))) {
        (req as any).mediaType = "image";
      } else {
        return next(new BadRequestError("Chế độ batch chỉ hỗ trợ file ảnh."));
      }
    } else {
      return next(new BadRequestError("Không tìm thấy file."));
    }
    next();
  };
};