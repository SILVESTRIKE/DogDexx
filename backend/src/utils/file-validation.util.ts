import { openSync, readSync, closeSync, unlinkSync } from 'fs';
import { logger } from './logger.util';

/**
 * Magic bytes cho các định dạng file phổ biến
 * 
 * Magic bytes là các byte đầu tiên của file dùng để xác định định dạng thực sự,
 * bất kể extension hay MIME type được khai báo.
 */
const MAGIC_BYTES: Record<string, Buffer[]> = {
    // Images
    'image/jpeg': [
        Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]),  // JFIF
        Buffer.from([0xFF, 0xD8, 0xFF, 0xE1]),  // EXIF
        Buffer.from([0xFF, 0xD8, 0xFF, 0xDB]),  // Raw JPEG
        Buffer.from([0xFF, 0xD8, 0xFF, 0xEE]),  // JPEG with comment
    ],
    'image/png': [
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])  // PNG signature
    ],
    'image/gif': [
        Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]),  // GIF87a
        Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])   // GIF89a
    ],
    'image/webp': [
        Buffer.from([0x52, 0x49, 0x46, 0x46])  // RIFF header (WebP starts with RIFF)
    ],
    'image/bmp': [
        Buffer.from([0x42, 0x4D])  // BM
    ],
    'image/tiff': [
        Buffer.from([0x49, 0x49, 0x2A, 0x00]),  // Little endian
        Buffer.from([0x4D, 0x4D, 0x00, 0x2A])   // Big endian
    ],
    'image/svg+xml': [
        Buffer.from([0x3C, 0x3F, 0x78, 0x6D, 0x6C]),  // <?xml
        Buffer.from([0x3C, 0x73, 0x76, 0x67])         // <svg
    ],
    'image/heic': [
        Buffer.from([0x00, 0x00, 0x00])  // HEIC starts with ftyp box
    ],

    // Videos
    'video/mp4': [
        Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),  // ftyp at offset 4
        Buffer.from([0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70]),
        Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]),
        Buffer.from([0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D]),  // ftypisom
        Buffer.from([0x66, 0x74, 0x79, 0x70, 0x4D, 0x53, 0x4E, 0x56]),  // ftypMSNV
    ],
    'video/quicktime': [
        Buffer.from([0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74])  // ftypqt
    ],
    'video/webm': [
        Buffer.from([0x1A, 0x45, 0xDF, 0xA3])  // EBML header
    ],
    'video/x-msvideo': [
        Buffer.from([0x52, 0x49, 0x46, 0x46])  // RIFF (AVI)
    ],

    // Documents (for health records attachments)
    'application/pdf': [
        Buffer.from([0x25, 0x50, 0x44, 0x46])  // %PDF
    ],
};

/**
 * Danh sách MIME types được phép
 */
const ALLOWED_MIME_TYPES = new Set([
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'image/svg+xml',
    'image/heic',
    // Videos
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-msvideo',
    // Documents
    'application/pdf',
]);

/**
 * Kiểm tra file có đúng định dạng không bằng magic bytes
 * 
 * @param filePath - Đường dẫn đến file cần kiểm tra
 * @param declaredMimetype - MIME type được khai báo từ client
 * @returns true nếu file hợp lệ, false nếu bị giả mạo
 * 
 * @example
 * ```typescript
 * if (!validateFileMagicBytes('/tmp/upload.jpg', 'image/jpeg')) {
 *   throw new Error('File format mismatch');
 * }
 * ```
 */
export function validateFileMagicBytes(filePath: string, declaredMimetype: string): boolean {
    try {
        // 1. Kiểm tra MIME type có được phép không
        if (!ALLOWED_MIME_TYPES.has(declaredMimetype)) {
            logger.warn(`[FileValidation] Unsupported MIME type: ${declaredMimetype}`);
            return false;
        }

        // 2. Đọc 20 bytes đầu tiên của file
        const buffer = Buffer.alloc(20);
        const fd = openSync(filePath, 'r');
        try {
            readSync(fd, buffer, 0, 20, 0);
        } finally {
            closeSync(fd);
        }

        // 3. Lấy magic bytes mong đợi cho MIME type này
        const expectedMagicBytes = MAGIC_BYTES[declaredMimetype];

        if (!expectedMagicBytes) {
            // Không có magic bytes định nghĩa cho loại file này
            // Log cảnh báo nhưng vẫn cho phép (để không break các loại file mới)
            logger.warn(`[FileValidation] No magic bytes defined for MIME type: ${declaredMimetype}. Allowing file.`);
            return true;
        }

        // 4. Kiểm tra xem file có bắt đầu bằng magic bytes mong đợi không
        const isValid = expectedMagicBytes.some(magic => {
            const fileHeader = buffer.slice(0, magic.length);
            return fileHeader.equals(magic);
        });

        if (!isValid) {
            logger.warn(
                `[FileValidation] MAGIC BYTES MISMATCH! ` +
                `Declared: ${declaredMimetype}, ` +
                `Actual header: ${buffer.slice(0, 10).toString('hex').toUpperCase()}`
            );
        } else {
            logger.debug(`[FileValidation] File validated successfully: ${declaredMimetype}`);
        }

        return isValid;

    } catch (error) {
        logger.error('[FileValidation] Error validating file magic bytes:', error);
        // Reject on error for safety
        return false;
    }
}

/**
 * Validate và xóa file nếu không hợp lệ
 * 
 * @param filePath - Đường dẫn file
 * @param declaredMimetype - MIME type khai báo
 * @returns true nếu hợp lệ, false nếu không hợp lệ (file đã bị xóa)
 */
export function validateAndCleanupFile(filePath: string, declaredMimetype: string): boolean {
    const isValid = validateFileMagicBytes(filePath, declaredMimetype);

    if (!isValid) {
        try {
            unlinkSync(filePath);
            logger.info(`[FileValidation] Deleted invalid file: ${filePath}`);
        } catch (deleteError) {
            logger.error(`[FileValidation] Failed to delete invalid file: ${filePath}`, deleteError);
        }
    }

    return isValid;
}

/**
 * Validate nhiều files cùng lúc
 * 
 * @param files - Mảng các file từ multer
 * @returns Object với isValid và danh sách invalidFiles
 */
export function validateMultipleFiles(files: Express.Multer.File[]): {
    isValid: boolean;
    invalidFiles: string[];
} {
    const invalidFiles: string[] = [];

    for (const file of files) {
        if (!validateFileMagicBytes(file.path, file.mimetype)) {
            invalidFiles.push(file.originalname);
            try {
                unlinkSync(file.path);
            } catch { /* ignore cleanup errors */ }
        }
    }

    return {
        isValid: invalidFiles.length === 0,
        invalidFiles
    };
}
