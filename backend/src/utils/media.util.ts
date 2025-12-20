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

/**
 * Danh sách folders PRIVATE (bắt buộc xác thực để truy cập)
 * - health_records: Hồ sơ sức khỏe thú cưng (nhạy cảm)
 * - verification: Ảnh xác thực tìm chó
 * - processed: Ảnh đã xử lý AI
 * - uploads: Uploads chung của user
 */
const PRIVATE_FOLDERS = [
    'health_records',
    'verification',
    'processed/',
    'uploads/'
];

/**
 * Danh sách folders PUBLIC (ai cũng xem được)
 * - avatars: Ảnh đại diện user
 * - wiki: Ảnh Dog Wiki
 * - dataset/approved: Dataset đã duyệt
 * - dog-data-img: Ảnh data chó
 * - posts: Ảnh bài đăng cộng đồng
 */
const PUBLIC_FOLDERS = [
    'avatars',
    'wiki',
    'dataset/approved',
    'dog-data-img',
    'posts'
];

const isPublicFolder = (pathOrFolder: string): boolean => {
    // Chuẩn hóa đường dẫn để tránh lỗi dấu gạch chéo
    const normalized = pathOrFolder.replace(/\\/g, '/').toLowerCase();

    // Kiểm tra private folders trước (ưu tiên bảo mật)
    if (PRIVATE_FOLDERS.some(pf => normalized.includes(pf.toLowerCase()))) {
        return false;
    }

    // Kiểm tra public folders
    return PUBLIC_FOLDERS.some(pf => normalized.includes(pf.toLowerCase()));
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

export const uploadMultipleFilesToCloudinary = async (
    files: Express.Multer.File[],
    folder: string,
    resource_type: 'image' | 'video' = 'image'
): Promise<string[]> => {
    const urls: string[] = [];

    for (const file of files) {
        const public_id = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const result = await uploadFileToCloudinary(
            file.path,
            public_id,
            folder,
            resource_type,
            'public'
        );
        urls.push(result.secure_url);

        // Clean up temp file
        const fs = await import('fs');
        if (file.path && fs.existsSync(file.path)) {
            fs.promises.unlink(file.path).catch(() => { });
        }
    }

    return urls;
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
        if ((normalizedPath.startsWith('public/') || normalizedPath.startsWith('uploads/') || normalizedPath.startsWith('dataset/') || normalizedPath.startsWith('processed/') || normalizedPath.startsWith('dog-data-img/')) && CLOUD_NAME) {

            // Kiểm tra video dựa trên cả folder path VÀ extension của file
            const videoExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv'];
            const isVideoFile = videoExtensions.some(ext => normalizedPath.toLowerCase().endsWith(ext));
            const resourceType = (normalizedPath.includes('/videos/') || isVideoFile) ? 'video' : 'image';

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
            if ((key === 'mediaPath' || key === 'processedMediaPath' || key === 'avatarPath' || key === 'imagePath' || key === 'url' || key === 'photos') && (typeof obj[key] === 'string' || Array.isArray(obj[key]))) {
                if (key === 'photos' && Array.isArray(obj[key])) {
                    obj[key] = obj[key].map((path: string) => createFullUrl(path));
                } else if (typeof obj[key] === 'string') {
                    const newKey = key.endsWith('Path') ? key.replace('Path', 'Url') : 'url';
                    obj[newKey] = createFullUrl(obj[key]);
                }
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