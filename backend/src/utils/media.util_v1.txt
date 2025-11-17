import { Request } from 'express';

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
        obj.mediaUrl = createUrl(obj.mediaPath); // Đổi thành mediaUrl cho mục đích chung
        delete obj.mediaPath;
    }

    if (typeof obj.imagePath === 'string') {
        obj.imageUrl = createUrl(obj.imagePath);
        delete obj.imagePath;
    }

    if (typeof obj.avatarPath === 'string') {
        obj.avatarUrl = createUrl(obj.avatarPath);
        delete obj.avatarPath;
    }

    if (typeof obj.processedMediaPath === 'string') {
        obj.processedMediaUrl = createUrl(obj.processedMediaPath);
        delete obj.processedMediaPath;
    }

    // Lặp qua tất cả các key của object để xử lý các object/array lồng nhau
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