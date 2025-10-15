import { Router } from 'express';
import { getPokedex, addBreed, getAchievements, getStats } from '../controllers/bff_collection.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { optionalAuthMiddleware } from '../middlewares/optionalAuth.middleware';

const router = Router();

/**
 * @swagger
 * /bff/collection/pokedex:
 *   get:
 *     summary: (BFF) Lấy danh sách Pokedex
 *     tags: [BFF-Collection]
 *     description: Lấy danh sách tất cả các giống chó, kèm theo trạng thái sưu tầm của người dùng (nếu đã đăng nhập) và tiến trình.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Tìm kiếm theo tên giống chó.
 *       - in: query
 *         name: group
 *         schema: { type: string }
 *         description: Lọc theo nhóm chó (ví dụ 'Working', 'Herding').
 *       - in: query
 *         name: energy_level
 *         schema: { type: integer, minimum: 1, maximum: 5 }
 *         description: Lọc theo mức năng lượng (1-5).
 *       - in: query
 *         name: trainability
 *         schema: { type: integer, minimum: 1, maximum: 5 }
 *         description: Lọc theo khả năng huấn luyện (1-5).
 *       - in: query
 *         name: shedding_level
 *         schema: { type: integer, minimum: 1, maximum: 5 }
 *         description: Lọc theo mức độ rụng lông (1-5).
 *       - in: query
 *         name: suitable_for
 *         schema: { type: string }
 *         description: Lọc theo đối tượng phù hợp (ví dụ 'gia-dinh-co-tre-nho').
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: 'display_name' }
 *         description: Sắp xếp theo trường (ví dụ 'energy_level').
 *     responses:
 *       200:
 *         description: Lấy Pokedex thành công.
 */
router.get('/pokedex', optionalAuthMiddleware, getPokedex);

/**
 * @swagger
 * /bff/collection/add/{slug}:
 *   post:
 *     summary: (BFF) Thêm một giống chó vào bộ sưu tập
 *     tags: [BFF-Collection]
 *     description: Thêm một giống chó vào bộ sưu tập của người dùng và kiểm tra các thành tích mới có thể được mở khóa.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Slug của giống chó cần thêm.
 *     responses:
 *       200:
 *         description: Thêm thành công.
 */
router.post('/add/:slug', authMiddleware, addBreed);

/**
 * @swagger
 * /bff/collection/achievements:
 *   get:
 *     summary: Lấy danh sách achievements của user
<<<<<<< Updated upstream
 *     tags:
 *       - Achievements
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của user
 *     responses:
 *       200:
 *         description: Danh sách achievements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 achievements:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Thiếu userId
 *       500:
 *         description: Lỗi server
 */
router.get('/achievements', authMiddleware, getAchievements);

/**
 * @swagger
 * /bff/collection/stats:
 *   get:
 *     summary: (BFF) Lấy thống kê bộ sưu tập
 *     tags: [BFF-Collection]
 *     description: Lấy các số liệu thống kê về bộ sưu tập của người dùng.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thống kê thành công.
 */
router.get('/stats', authMiddleware, getStats);

export default router;
