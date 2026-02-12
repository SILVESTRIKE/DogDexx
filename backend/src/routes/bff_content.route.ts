import { Router } from 'express';
import { getBreedDetail, getBreeds, uploadMedia,
	listMedia, getMediaById, updateMedia, deleteMedia,
	createDirectory, getDirectories, getDirectoryContent, renameDirectory, moveDirectory, deleteDirectory
} from '../controllers/bff_content.controller';
import { optionalAuthMiddleware } from '../middlewares/optionalAuth.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { uploadSingle } from '../middlewares/upload.middleware';

const router = Router();

router.use(optionalAuthMiddleware);

/**
 * @swagger
 * /bff/content/breed/{slug}:
 *   get:
 *     summary: (BFF) Lấy chi tiết một giống chó
 *     tags: [BFF-Content]
 *     description: Lấy thông tin chi tiết của một giống chó, kèm theo trạng thái sưu tầm của người dùng (nếu đã đăng nhập).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug của giống chó.
 *     responses:
 *       200:
 *         description: Lấy chi tiết thành công.
 */
router.get('/breed/:slug', optionalAuthMiddleware, getBreedDetail);

/**
 * @swagger
 * /bff/content/breeds:
 *   get:
 *     summary: (BFF) Lấy danh sách các giống chó
 *     tags: [BFF-Content]
 *     description: Lấy danh sách các giống chó với bộ lọc và sắp xếp. Tương tự /api/wiki nhưng thuộc nhóm BFF.
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công.
 */
router.get('/breeds', getBreeds);

/**
 * @swagger
 * /bff/content/media/upload:
 *   post:
 *     summary: (BFF) Tải lên một file media
 *     tags: [BFF-Content]
 *     description: Tải lên một file media (ảnh/video) cho người dùng đã đăng nhập.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Tải lên thành công.
 */
router.post('/media/upload', authMiddleware, uploadSingle, uploadMedia);

// BFF media management wrappers
/**
 * @swagger
 * /bff/content/media:
 *   get:
 *     summary: (BFF) Lấy danh sách media của người dùng
 *     tags: [BFF-Content]
 *     description: Lấy danh sách media của người dùng hiện tại (nếu đã đăng nhập).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công.
 */
router.get('/media', optionalAuthMiddleware, listMedia);

/**
 * @swagger
 * tags:
 *   - name: BFF-Content
 * /bff/content/media/{id}:
 *   get:
 *     summary: (BFF) Lấy chi tiết một media
 *     tags: [BFF-Content]
 *     description: Lấy thông tin chi tiết của một file media bằng ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy chi tiết thành công.
 *       404:
 *         description: Không tìm thấy media.
 */
router.get('/media/:id', optionalAuthMiddleware, getMediaById);

/**
 * @swagger
 * tags:
 *   - name: BFF-Content
 * /bff/content/media/{id}:
 *   patch:
 *     summary: (BFF) Cập nhật thông tin media
 *     tags: [BFF-Content]
 *     description: "Cập nhật thông tin của một file media (ví dụ: đổi tên)."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công.
 */
router.patch('/media/:id', authMiddleware, updateMedia);

/**
 * @swagger
 * /bff/content/media/{id}:
 *   delete:
 *     summary: (BFF) Xóa một media
 *     tags: [BFF-Content]
 *     description: Xóa một file media của người dùng.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công.
 */
router.delete('/media/:id', authMiddleware, deleteMedia);

// BFF directory management wrappers
/**
 * @swagger
 * /bff/content/directories:
 *   post:
 *     summary: (BFF) Tạo thư mục mới
 *     tags: [BFF-Content-Directory]
 *     description: Tạo một thư mục mới cho người dùng.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: "Tên thư mục mới"
 *               parent_id:
 *                 type: string
 *                 nullable: true
 *                 description: "ID của thư mục cha (null nếu là thư mục gốc)"
 *             required:
 *               - name
 *     responses:
 *       201:
 *         description: Tạo thư mục thành công.
 */
router.post('/directories', authMiddleware, createDirectory);

/**
 * @swagger
 * /bff/content/directories:
 *   get:
 *     summary: (BFF) Lấy cây thư mục
 *     tags: [BFF-Content-Directory]
 *     description: Lấy cấu trúc cây thư mục của người dùng.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy cây thư mục thành công.
 */
router.get('/directories', authMiddleware, getDirectories);

/**
 * @swagger
 * /bff/content/directories/content/{id}:
 *   get:
 *     summary: (BFF) Lấy nội dung thư mục
 *     tags: [BFF-Content-Directory]
 *     description: Lấy nội dung (thư mục con và files) của một thư mục cụ thể.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy nội dung thành công.
 */
router.get('/directories/content/:id', authMiddleware, getDirectoryContent);

/**
 * @swagger
 * /bff/content/directories/{id}/rename:
 *   patch:
 *     summary: (BFF) Đổi tên thư mục
 *     tags: [BFF-Content-Directory]
 *     description: Cập nhật tên cho một thư mục.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của thư mục cần đổi tên
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: "Tên mới của thư mục"
 *             required:
 *               - name
 *     responses:
 *       200:
 *         description: Đổi tên thành công.
 *       404:
 *         description: Thư mục không tồn tại.
 */
router.patch('/directories/:id/rename', authMiddleware, renameDirectory);

/**
 * @swagger
 * /bff/content/directories/{id}/move:
 *   patch:
 *     summary: (BFF) Di chuyển thư mục
 *     tags: [BFF-Content-Directory]
 *     description: Di chuyển thư mục sang một thư mục cha khác.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của thư mục cần di chuyển
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               parent_id:
 *                 type: string
 *                 nullable: true
 *                 description: "ID của thư mục cha mới (null nếu chuyển về gốc)"
 *             required:
 *               - parent_id
 *     responses:
 *       200:
 *         description: Di chuyển thành công.
 *       404:
 *         description: Thư mục không tồn tại.
 */
router.patch('/directories/:id/move', authMiddleware, moveDirectory);

/**
 * @swagger
 * /bff/content/directories/{id}:
 *   delete:
 *     summary: (BFF) Xóa thư mục
 *     tags: [BFF-Content-Directory]
 *     description: Xóa một thư mục (cần đảm bảo thư mục rỗng hoặc xử lý logic xóa đệ quy tùy backend).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của thư mục cần xóa
 *     responses:
 *       200:
 *         description: Xóa thành công.
 *       400:
 *         description: Không thể xóa (ví dụ thư mục không rỗng).
 *       404:
 *         description: Thư mục không tồn tại.
 */
router.delete('/directories/:id', authMiddleware, deleteDirectory);

export default router;