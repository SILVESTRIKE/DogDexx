import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { collectionController } from '../controllers/user_collection.controller';

const router = Router();

/**
 * @swagger
 * /api/collections/me:
 *   get:
 *     summary: Lấy bộ sưu tập của người dùng hiện tại
 *     description: Lấy danh sách các giống chó trong bộ sưu tập của người dùng đã đăng nhập.
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách bộ sưu tập
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserCollectionResponse'
 *       400:
 *         description: Yêu cầu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Không được phép (chưa đăng nhập)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/api/collections/me', authMiddleware, collectionController.getMyCollection);

export { router as collectionRoutes };