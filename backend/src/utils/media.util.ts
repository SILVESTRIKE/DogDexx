import { Request } from 'express';

const CLOUD_NAME = process.env.CLOUD_NAME_CLOUDINARY;

const transformPaths = (req: Request, data: any): any => {
    // Điều kiện dừng đệ quy: nếu data không phải object, hoặc là null/Date, trả về chính nó.
    if (data === null || typeof data !== 'object' || data instanceof Date) return data;
    // Nếu là mảng, áp dụng hàm cho từng phần tử.
    if (Array.isArray(data)) return data.map(item => transformPaths(req, item));

    // Sao chép object để tránh thay đổi dữ liệu gốc (đặc biệt quan trọng với Mongoose documents).
    const obj = typeof data.toObject === 'function' ? data.toObject() : { ...data };

    const createFullUrl = (dbPath: string) => {
        if (!dbPath) return dbPath;

        // SỬA LỖI: Nếu dbPath đã là một URL đầy đủ, trả về ngay lập tức.
        if (dbPath.startsWith('http://') || dbPath.startsWith('https://')) return dbPath;

        // 1. Xử lý các đường dẫn Cloudinary (bắt đầu bằng 'public/')
        if ((dbPath.startsWith('public/') || dbPath.startsWith('uploads/') || dbPath.startsWith('dataset/')) && CLOUD_NAME) {
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