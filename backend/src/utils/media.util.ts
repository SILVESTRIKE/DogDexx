import { Request } from 'express';
import { Types } from 'mongoose';
import { cloudinary } from '../config/cloudinary.config';
import { UploadApiResponse } from 'cloudinary';
import dotenv from 'dotenv';
import { logger } from './logger.util'; // Nhớ import logger để debug

dotenv.config();

const CLOUD_NAME = process.env.CLOUD_NAME_CLOUDINARY;

export type AccessMode = 'public' | 'private';

// 1. CHUẨN HÓA LOGIC KIỂM TRA FOLDER
// Hàm này phải đồng bộ tuyệt đối giữa lúc Upload và lúc View
const isPublicFolder = (pathOrFolder: string): boolean => {
    // Chuẩn hóa đường dẫn để tránh lỗi dấu gạch chéo
    const normalized = pathOrFolder.replace(/\\/g, '/');
    return (
        normalized.includes('avatars') ||
        normalized.includes('wiki') ||
        normalized.includes('dataset/approved') ||
        normalized.includes('dog-data-img') // <--- ĐÃ THÊM VÀO ĐÂY
    );
};

const getCloudinaryType = (folder: string): 'upload' | 'authenticated' => {
    if (isPublicFolder(folder)) {
        return 'upload'; // Public
    }
    return 'authenticated'; // Private
};

// 2. HÀM UPLOAD
export const uploadToCloudinary = (buffer: Buffer, folder: string, resource_type: 'image' | 'video' = 'image', access_mode?: AccessMode): Promise<UploadApiResponse> => {
    // Ưu tiên access_mode truyền vào, nếu không thì tự động theo folder
    const type = access_mode === 'public' ? 'upload' : (access_mode === 'private' ? 'authenticated' : getCloudinaryType(folder));

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: resource_type,
                type: type,
                // Thêm sign_url để lấy luôn link có chữ ký ngay sau khi up (nếu cần dùng ngay)
                sign_url: true
            },
            (error, result) => {
                if (result) {
                    resolve(result);
                } else {
                    logger.error("Cloudinary Upload Error:", error);
                    reject(error);
                }
            }
        );
        stream.end(buffer);
    });
};

export const uploadFileToCloudinary = (filePath: string, public_id_without_ext: string, folder: string, resource_type: 'image' | 'video' = 'image', access_mode?: AccessMode): Promise<UploadApiResponse> => {
    const type = access_mode === 'public' ? 'upload' : (access_mode === 'private' ? 'authenticated' : getCloudinaryType(folder));

    return cloudinary.uploader.upload(filePath, {
        folder: folder,
        public_id: public_id_without_ext,
        resource_type: resource_type,
        type: type,
    });
};

// 3. HÀM TẠO URL (VIEW)
const transformPaths = (req: Request, data: any): any => {
    if (data === null || typeof data !== 'object' || data instanceof Date || data instanceof Types.ObjectId) return data;
    if (Array.isArray(data)) return data.map(item => transformPaths(req, item));

    const obj = typeof data.toObject === 'function' ? data.toObject() : { ...data };

    const createFullUrl = (dbPath: string) => {
        if (!dbPath) return dbPath;
        if (dbPath.startsWith('http://') || dbPath.startsWith('https://') || dbPath.startsWith('data:')) return dbPath;

        // Chuẩn hóa path
        const normalizedPath = dbPath.replace(/\\/g, '/').replace(/^\/+/, '');

        // Kiểm tra xem path có phải là file trên Cloudinary không
        // (Thêm check 'processed/' vào list nếu bạn lưu ảnh processed lên đó)
        if ((normalizedPath.startsWith('public/') || normalizedPath.startsWith('uploads/') || normalizedPath.startsWith('dataset/') || normalizedPath.startsWith('processed/') || normalizedPath.startsWith('dog-data-img/')) && CLOUD_NAME) {

            const resourceType = normalizedPath.includes('/videos/') ? 'video' : 'image';

            // Lấy Public ID (bỏ đuôi mở rộng nếu là ảnh)
            const publicId = resourceType === 'image'
                ? normalizedPath.substring(0, normalizedPath.lastIndexOf('.')) || normalizedPath
                : normalizedPath;

            // Xác định Public hay Private dựa trên cùng logic với lúc Upload
            const isPublic = isPublicFolder(normalizedPath);
            const type = isPublic ? 'upload' : 'authenticated';

            try {
                if (type === 'authenticated') {
                    // --- PRIVATE URL (CÓ CHỮ KÝ & HẾT HẠN) ---
                    return cloudinary.url(publicId, {
                        resource_type: resourceType,
                        type: 'authenticated',
                        sign_url: true, // Ký URL bằng API Secret (Chuẩn)
                        secure: true
                        // auth_token: removed to fix 401. sign_url is sufficient for 'authenticated' assets.
                    });
                } else {
                    // --- PUBLIC URL ---
                    return cloudinary.url(publicId, {
                        resource_type: resourceType,
                        type: 'upload',
                        secure: true,
                        // Có thể thêm transformation mặc định để tối ưu ảnh public
                        transformation: [{ quality: "auto", fetch_format: "auto" }]
                    });
                }
            } catch (error) {
                // Fallback thủ công nếu SDK lỗi
                const typeStr = isPublic ? 'upload' : 'authenticated';
                return `https://res.cloudinary.com/${CLOUD_NAME}/${resourceType}/${typeStr}/${publicId}`;
            }
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const cleanPath = dbPath.startsWith('/') ? dbPath : `/${dbPath}`;
        return `${baseUrl}${cleanPath.replace(/\\/g, "/")}`;
    }

    // Quét các key chứa đường dẫn ảnh
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if ((key === 'mediaPath' || key === 'processedMediaPath' || key === 'avatarPath' || key === 'imagePath' || key === 'url') && typeof obj[key] === 'string') {
                const newKey = key.endsWith('Path') ? key.replace('Path', 'Url') : 'url';
                obj[newKey] = createFullUrl(obj[key]);
            }
            // Đệ quy
            obj[key] = transformPaths(req, obj[key]);
        }
    }
    return obj;
};

export const transformMediaURLs = (req: Request, data: any): any => {
    return transformPaths(req, data);
};