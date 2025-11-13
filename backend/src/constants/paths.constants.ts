import path from 'path';

/**
 * Thư mục gốc chứa các file media do người dùng tải lên.
 * Đây là nơi lưu trữ vật lý ban đầu.
 */
export const MEDIA_UPLOAD_DIR = path.resolve(__dirname, '../../public/uploads');

/**
 * Thư mục chứa ảnh đại diện của người dùng.
 */
export const AVATAR_UPLOAD_DIR = path.resolve(__dirname, '../../public/useravatar');

/**
 * Thư mục gốc cho bộ dữ liệu dùng để training model.
 * Bao gồm các thư mục con như 'pending', 'approved', 'rejected'.
 */
export const DATASET_DIR = path.resolve(__dirname, '../../public/dataset');
