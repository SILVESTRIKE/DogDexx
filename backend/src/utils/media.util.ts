import { Request } from 'express';
import { Types } from 'mongoose';

const CLOUD_NAME = process.env.CLOUD_NAME_CLOUDINARY;
import { cloudinary } from '../config/cloudinary.config';
import { UploadApiResponse } from 'cloudinary';

export const uploadToCloudinary = (buffer: Buffer, folder: string, resource_type: 'image' | 'video' = 'image'): Promise<UploadApiResponse> => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: resource_type,
            },
            (error, result) => {
                if (result) {
                    resolve(result);
                } else {
                    reject(error);
                }
            }
        );
        stream.end(buffer);
    });
};

const transformPaths = (req: Request, data: any): any => {
    if (data === null || typeof data !== 'object' || data instanceof Date || data instanceof Types.ObjectId) return data;
    if (Array.isArray(data)) return data.map(item => transformPaths(req, item));

    const obj = typeof data.toObject === 'function' ? data.toObject() : { ...data };

    const createFullUrl = (dbPath: string) => {
        if (!dbPath) return dbPath;

        if (dbPath.startsWith('http://') || dbPath.startsWith('https://') || dbPath.startsWith('data:')) return dbPath;

        if ((dbPath.startsWith('public/') || dbPath.startsWith('uploads/') || dbPath.startsWith('dataset/')) && CLOUD_NAME) {
            const resourceType = dbPath.includes('/videos/') ? 'video' : 'image';
            const publicIdWithFolder = dbPath.replace(/\\/g, "/");

            const publicId = resourceType === 'image'
                ? publicIdWithFolder.substring(0, publicIdWithFolder.lastIndexOf('.')) || publicIdWithFolder
                : publicIdWithFolder;

            return `https://res.cloudinary.com/${CLOUD_NAME}/${resourceType}/upload/${publicId}`;
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const cleanPath = dbPath.startsWith('/') ? dbPath : `/${dbPath}`;
        return `${baseUrl}${cleanPath.replace(/\\/g, "/")}`;
    }

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if ((key === 'mediaPath' || key === 'processedMediaPath' || key === 'avatarPath' || key === 'imagePath' || key === 'url') && typeof obj[key] === 'string') {
                const newKey = key.endsWith('Path') ? key.replace('Path', 'Url') : 'url';
                obj[newKey] = createFullUrl(obj[key]);
            }
            obj[key] = transformPaths(req, obj[key]);
        }
    }
    return obj;
};

export const transformMediaURLs = (req: Request, data: any): any => {
    return transformPaths(req, data);
};