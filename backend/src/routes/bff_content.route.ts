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
router.get('/media', optionalAuthMiddleware, listMedia);
router.get('/media/:id', optionalAuthMiddleware, getMediaById);
router.patch('/media/:id', authMiddleware, updateMedia);
router.delete('/media/:id', authMiddleware, deleteMedia);

// BFF directory management wrappers
router.post('/directories', authMiddleware, createDirectory);
router.get('/directories', authMiddleware, getDirectories);
router.get('/directories/content/:id', authMiddleware, getDirectoryContent);
router.patch('/directories/:id/rename', authMiddleware, renameDirectory);
router.patch('/directories/:id/move', authMiddleware, moveDirectory);
router.delete('/directories/:id', authMiddleware, deleteDirectory);

export default router;
