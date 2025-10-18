import { Router } from 'express';
import { getDashboard, getFeedback, getUsers, getModelConfig, updateModelConfig, getAlerts } from '../controllers/bff_admin.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { checkAllowedRoles } from '../middlewares/role.middleware';

const router = Router();

// Tất cả các route trong file này đều yêu cầu đăng nhập và có vai trò ADMIN
router.use(authMiddleware, checkAllowedRoles(['admin']));

/**
 * @swagger
 * /bff/admin/dashboard:
 *   get:
 *     summary: (BFF) Lấy dữ liệu tổng hợp cho dashboard
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Lấy các số liệu thống kê chính cho trang dashboard của admin.
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thành công.
 */
router.get('/dashboard', getDashboard);

/**
 * @swagger
 * /bff/admin/feedback:
 *   get:
 *     summary: (BFF) Quản lý feedback
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Lấy danh sách feedback từ người dùng để quản lý.
 *     responses:
 *       200:
 *         description: Lấy danh sách feedback thành công.
 */
router.get('/feedback', getFeedback);

/**
 * @swagger
 * /bff/admin/users:
 *   get:
 *     summary: (BFF) Quản lý người dùng
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Lấy danh sách người dùng kèm theo các thống kê liên quan.
 *     responses:
 *       200:
 *         description: Lấy danh sách người dùng thành công.
 */
router.get('/users', getUsers);

/**
 * @swagger
 * /bff/admin/model/config:
 *   get:
 *     summary: (BFF) Lấy cấu hình model hiện tại
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy cấu hình thành công.
 */
router.get('/model/config', getModelConfig);

/**
 * @swagger
 * /bff/admin/model/config:
 *   put:
 *     summary: (BFF) Cập nhật cấu hình model
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Cập nhật các tham số của AI service (threshold, device, model path) và kích hoạt việc tải lại cấu hình.
 *     responses:
 *       200:
 *         description: Cập nhật thành công.
 */
router.put('/model/config', updateModelConfig);

/**
 * @swagger
 * /bff/admin/alerts:
 *   get:
 *     summary: (BFF) Lấy các cảnh báo hệ thống
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Lấy các cảnh báo, ví dụ như các giống chó mới tiềm năng cần được thêm vào hệ thống.
 *     responses:
 *       200:
 *         description: Lấy cảnh báo thành công.
 */
router.get('/alerts', getAlerts);

export default router;
