import path from 'path';

/**
 * Xác định đường dẫn tuyệt đối đến thư mục gốc của project (thư mục chứa package.json).
 * Giả định rằng file constants này nằm trong `backend/src/constants`. 
 * Chúng ta cần đi ngược lại 3 cấp để đến thư mục gốc của backend.
 * Hãy điều chỉnh số lượng '../' cho phù hợp với cấu trúc dự án của bạn.
 */
const PROJECT_ROOT = path.join(__dirname, '..', '..'); // Điều chỉnh nếu cần

/**
 * Thư mục public, nơi server sẽ phục vụ các file tĩnh.
 * Đây là đường dẫn vật lý trên đĩa.
 */
export const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

/**
 * Thư mục gốc chứa các file media do người dùng tải lên.
 * Đây là đường dẫn vật lý trên đĩa.
 */
export const MEDIA_UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');

/**
 * Thư mục chứa ảnh đại diện của người dùng.
 * Đây là đường dẫn vật lý trên đĩa.
 */
export const AVATAR_UPLOAD_DIR = path.join(PUBLIC_DIR, 'useravatar');

/**
 * Thư mục gốc cho bộ dữ liệu dùng để training model.
 */
export const DATASET_DIR = path.join(PUBLIC_DIR, 'dataset');