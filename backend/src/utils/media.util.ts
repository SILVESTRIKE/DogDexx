import { Request } from 'express';

/**
 * Hàm đệ quy để chuyển đổi các trường `...Path` thành `...Url` trong một đối tượng hoặc mảng.
 * @param data Dữ liệu đầu vào (object hoặc array).
 * @param baseUrl URL gốc của server (ví dụ: http://localhost:3000).
 * @returns Dữ liệu đã được chuyển đổi.
 */
const transformPaths = (data: any, baseUrl: string): any => {
    if (data === null || typeof data !== 'object' || data instanceof Date) return data;
    if (Array.isArray(data)) return data.map(item => transformPaths(item, baseUrl));

    // Sao chép đối tượng để tránh thay đổi đối tượng gốc
    const obj = typeof data.toObject === 'function' ? data.toObject() : { ...data };

    // Hàm helper để tạo URL an toàn, tránh bị lặp dấu '/'
    const createUrl = (path: string) => {
        // Đảm bảo path luôn bắt đầu bằng một dấu '/'
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        return `${baseUrl}${cleanPath.replace(/\\/g, "/")}`;
    }

    if (typeof obj.mediaPath === 'string') {
        obj.mediaUrl = createUrl(obj.mediaPath);
        delete obj.mediaPath;
    }

<<<<<<< Updated upstream
=======
    if (typeof obj.imagePath === 'string') {
        obj.imageUrl = createUrl(obj.imagePath);
        delete obj.imagePath;
    }

    if (typeof obj.processedMediaPath === 'string') {
        obj.processedMediaUrl = createUrl(obj.processedMediaPath);
        delete obj.processedMediaPath;
    }

    // Lặp qua tất cả các key của object để xử lý các object/array lồng nhau
>>>>>>> Stashed changes
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            obj[key] = transformPaths(obj[key], baseUrl);
        }
    }

    return obj;
};

export const transformMediaURLs = (req: Request, data: any): any => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    // Xử lý cả trường hợp data là object đơn lẻ hoặc một mảng các object
    if (Array.isArray(data)) {
        return data.map(item => transformPaths(item, baseUrl));
    }
    return transformPaths(data, baseUrl);
};