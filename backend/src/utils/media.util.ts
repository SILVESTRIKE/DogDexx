import { Request } from 'express';
import path from 'path';

// Lấy Cloudinary cloud name từ biến môi trường.
const CLOUD_NAME = process.env.CLOUD_NAME_CLOUDINARY;

/**
 * Hàm đệ quy để biến đổi các đường dẫn media lưu trong DB thành URL Cloudinary đầy đủ.
 * @param req - Đối tượng Request của Express để lấy protocol và host.
 * @param data - Dữ liệu đầu vào (object hoặc array).
 * @returns Dữ liệu đã được biến đổi với các URL đầy đủ.
 */
const transformPaths = (req: Request, data: any): any => {
    // Điều kiện dừng đệ quy: nếu data không phải object, hoặc là null/Date, trả về chính nó.
    if (data === null || typeof data !== 'object' || data instanceof Date) return data;
    // Nếu là mảng, áp dụng hàm cho từng phần tử.
    if (Array.isArray(data)) return data.map(item => transformPaths(req, item));

    // Sao chép object để tránh thay đổi dữ liệu gốc (đặc biệt quan trọng với Mongoose documents).
    const obj = typeof data.toObject === 'function' ? data.toObject() : { ...data };

    // Hàm helper để tạo URL đầy đủ.
    const createFullUrl = (dbPath: string) => {
        if (!dbPath) return dbPath;

        // 1. Xử lý các đường dẫn Cloudinary (bắt đầu bằng 'public/')
        if (dbPath.startsWith('public/') && CLOUD_NAME) {
            // Xác định loại tài nguyên (image/video) dựa trên đường dẫn.
            const resourceType = dbPath.includes('/videos/') ? 'video' : 'image';
            const publicIdWithFolder = dbPath.replace(/\\/g, "/");

            // SỬA LỖI: Chỉ cắt bỏ phần mở rộng cho ảnh, giữ nguyên cho video.
            // Cloudinary cần phần mở rộng file (.mp4) trong URL để hiển thị video.
            const publicId = resourceType === 'image'
                ? publicIdWithFolder.substring(0, publicIdWithFolder.lastIndexOf('.')) || publicIdWithFolder
                : publicIdWithFolder;
            
            // Tạo URL Cloudinary hoàn chỉnh (không có phần mở rộng trong public_id).
            return `https://res.cloudinary.com/${CLOUD_NAME}/${resourceType}/upload/${publicId}`;
        }

        // 2. Xử lý các đường dẫn cục bộ (ví dụ: ảnh wiki, dataset)
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        // Đảm bảo path luôn bắt đầu bằng một dấu '/'
        const cleanPath = dbPath.startsWith('/') ? dbPath : `/${dbPath}`;
        return `${baseUrl}${cleanPath.replace(/\\/g, "/")}`;
    }

    // Lặp qua tất cả các key của object.
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            // Nếu key là một trong các trường media path và giá trị là string, tạo URL tương ứng.
            if ((key === 'mediaPath' || key === 'processedMediaPath' || key === 'avatarPath' || key === 'imagePath' || key === 'url') && typeof obj[key] === 'string') {
                const newKey = key.endsWith('Path') ? key.replace('Path', 'Url') : 'url';
                obj[newKey] = createFullUrl(obj[key]);
            }
            // Tiếp tục gọi đệ quy cho các giá trị là object hoặc array lồng nhau.
            obj[key] = transformPaths(req, obj[key]);
        }
    }
    return obj;
};

/**
 * Middleware/Wrapper để khởi tạo quá trình biến đổi URL.
 */
export const transformMediaURLs = (req: Request, data: any): any => {
    return transformPaths(req, data);
};