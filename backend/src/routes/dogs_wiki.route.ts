import { Router } from 'express';
import { wikiController } from '../controllers/dogs_wiki.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { checkAllowedRoles } from '../middlewares/role.middleware';

const router = Router();

// === PUBLIC ENDPOINTS ===
// Lấy danh sách tất cả các giống chó (có thể tìm kiếm theo tên)
// Ví dụ: GET /api/wiki?search=terrier&page=1&limit=10
/**
 * @swagger
 * /api/wiki:
 *   get:
 *     summary: Lấy danh sách tất cả các giống chó
 *     description: Lấy danh sách giống chó với hỗ trợ tìm kiếm theo tên và phân trang.
 *     tags: [Wiki]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
*         description: "Tìm kiếm giống chó theo tên (ví dụ: terrier)"
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *         description: Số lượng bản ghi mỗi trang
 *     responses:
 *       200:
 *         description: Danh sách giống chó
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedDogBreedWikiResponse'
 *       400:
 *         description: Yêu cầu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy tài nguyên
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/api/wiki', wikiController.getAll);

// Lấy thông tin chi tiết của một giống chó
/**
 * @swagger
 * /api/wiki/{slug}:
 *   get:
 *     summary: Lấy thông tin chi tiết của một giống chó
 *     description: Lấy thông tin chi tiết của một giống chó dựa trên slug.
 *     tags: [Wiki]
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *         description: Slug của giống chó
 *     responses:
 *       200:
 *         description: Thông tin chi tiết giống chó
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DogBreedWikiResponse'
 *       400:
 *         description: Yêu cầu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy giống chó
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/api/wiki/:slug', wikiController.getBySlug);

// === ADMIN ENDPOINTS (Yêu cầu đăng nhập và có vai trò 'admin') ===
/**
 * @swagger
 * /api/wiki:
 *   post:
 *     summary: Thêm một giống chó mới
 *     description: Tạo một giống chó mới (chỉ dành cho admin).
 *     tags: [Wiki]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DogBreedWikiCreatePayload'
 *     responses:
 *       201:
 *         description: Giống chó được tạo thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DogBreedWikiResponse'
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
 *       403:
 *         description: Không đủ quyền (không phải admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/api/wiki',
  authMiddleware,
  checkAllowedRoles(['admin']),
  wikiController.create
);

// Cập nhật thông tin một giống chó
/**
 * @swagger
 * /api/wiki/{slug}:
 *   put:
 *     summary: Cập nhật thông tin một giống chó
 *     description: Cập nhật thông tin của một giống chó dựa trên slug (chỉ dành cho admin).
 *     tags: [Wiki]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *         description: Slug của giống chó
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DogBreedWikiCreatePayload'
 *     responses:
 *       200:
 *         description: Giống chó được cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DogBreedWikiResponse'
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
 *       403:
 *         description: Không đủ quyền (không phải admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy giống chó
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  '/api/wiki/:slug',
  authMiddleware,
  checkAllowedRoles(['admin']),
  wikiController.update
);

// Xóa mềm một giống chó
/**
 * @swagger
 * /api/wiki/{slug}:
 *   delete:
 *     summary: Xóa mềm một giống chó
 *     description: Xóa mềm một giống chó dựa trên slug (chỉ dành cho admin).
 *     tags: [Wiki]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         schema:
 *           type: string
 *         required: true
 *         description: Slug của giống chó
 *     responses:
 *       200:
 *         description: Giống chó được xóa mềm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Giống chó đã được xóa mềm thành công
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
 *       403:
 *         description: Không đủ quyền (không phải admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy giống chó
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  '/api/wiki/:slug',
  authMiddleware,
  checkAllowedRoles(['admin']),
  wikiController.softDelete
);

export { router as wikiRoutes };