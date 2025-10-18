import { Request } from 'express';

const transformPaths = (data: any, baseUrl: string): any => {
    if (data === null || typeof data !== 'object' || data instanceof Date) return data;
    if (Array.isArray(data)) return data.map(item => transformPaths(item, baseUrl));

    const obj = typeof data.toObject === 'function' ? data.toObject() : { ...data };
    if (typeof obj.mediaPath === 'string') {
        obj.mediaURL = `${baseUrl}/${obj.mediaPath.replace(/\\/g, "/")}`;
        delete obj.mediaPath;
    }

    if (obj.imagePath) {
        delete obj.imagePath;
    }

    if (obj.processedMediaPath) {
        obj.processedMediaURL = `${baseUrl}${obj.processedMediaPath}`;
        delete obj.processedMediaPath;
    }

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            obj[key] = transformPaths(obj[key], baseUrl);
        }
    }
    return obj;
};

export const transformMediaURLs = (req: Request, data: any): any => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return transformPaths(data, baseUrl);
};