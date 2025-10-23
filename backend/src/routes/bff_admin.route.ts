import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { checkAllowedRoles } from '../middlewares/role.middleware';
import {
  getDashboard,
  getFeedback,
  approveFeedback,
  rejectFeedback,
  getUsers,
  createUser,
  updateUser,
  getModelConfig,
  updateModelConfig,
  getAlerts,
  uploadModel,
  getUsageStats,
  getHistories,
  browseMedia,
  getPlans,
  getSubscriptions,
} from '../controllers/bff_admin.controller';
import { browseHistories } from '../controllers/bff_admin.controller';
import { uploadSingle } from '../middlewares/upload.middleware';

const router = Router();

// Tất cả các route trong file này đều yêu cầu quyền admin
router.use(authMiddleware, checkAllowedRoles(['admin']));

/**
 * @swagger
 * /bff/admin/dashboard:
 *   get:
 *     summary: (BFF-Admin) Lấy dữ liệu cho trang dashboard
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thành công.
 */
router.get('/dashboard', getDashboard);

/**
 * @swagger
 * /bff/admin/feedback:
 *   get:
 *     summary: (BFF-Admin) Lấy danh sách feedback
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thành công.
 */
router.get('/feedback', getFeedback);

/**
 * @swagger
 * /bff/admin/feedback/{id}/approve:
 *   post:
 *     summary: (BFF-Admin) Duyệt một feedback
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Duyệt thành công.
 */
router.post('/feedback/:id/approve', approveFeedback);

/**
 * @swagger
 * /bff/admin/feedback/{id}/reject:
 *   post:
 *     summary: (BFF-Admin) Từ chối một feedback
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Từ chối thành công.
 */
router.post('/feedback/:id/reject', rejectFeedback);

/**
 * @swagger
 * /bff/admin/users:
 *   get:
 *     summary: (BFF-Admin) Lấy danh sách người dùng
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thành công.
 */
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);

router.get('/model/config', getModelConfig);
router.put('/model/config', updateModelConfig);

router.get('/alerts', getAlerts);

router.post('/models/upload', uploadSingle, uploadModel);
/**
 * @swagger
 * /bff/admin/usage:
 *   get:
 *     summary: (BFF-Admin) Lấy dữ liệu thống kê sử dụng
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thành công.
 */
router.get('/usage', getUsageStats);

/**
 * @swagger
 * /bff/admin/histories:
 *   get:
 *     summary: (BFF-Admin) Lấy toàn bộ lịch sử dự đoán
 *     tags: [BFF-Admin]
 *     description: Lấy danh sách tất cả lịch sử dự đoán với hỗ trợ phân trang và tìm kiếm (chỉ dành cho admin).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Tìm kiếm theo tên người dùng hoặc tên giống chó.
 *     responses:
 *       200:
 *         description: Lấy lịch sử thành công.
 *       403:
 *         description: Không có quyền truy cập.
 */
router.get(
  '/histories', getHistories
);

/**
 * @swagger
 * /bff/admin/histories/browse:
 *   get:
 *     summary: (BFF-Admin) Duyệt lịch sử dự đoán theo cấu trúc thư mục
 *     tags: [BFF-Admin]
 *     description: Lấy nội dung của một đường dẫn cụ thể trong cây thư mục lịch sử.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: path
 *         schema: { type: string }
 *         description: "Đường dẫn để duyệt. Ví dụ: '', 'userId', 'userId/2024', 'userId/2024/05', 'userId/2024/05/21'"
 *     responses:
 *       200: { description: "Lấy nội dung thành công." }
 */
router.get('/histories/browse', browseHistories);

/**
 * @swagger
 * /bff/admin/media/browse:
 *   get:
 *     summary: (BFF-Admin) Duyệt các file media đã tải lên
 *     tags: [BFF-Admin]
 *     description: Lấy nội dung của một đường dẫn cụ thể trong cây thư mục media ảo.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: path
 *         schema: { type: string }
 *         description: "Đường dẫn để duyệt. Ví dụ: '', 'username', 'username/images'"
 *     responses:
 *       200: { description: "Lấy nội dung thành công." }
 */
router.get('/media/browse', browseMedia);

/**
 * @swagger
 * /bff/admin/plans:
 *   get:
 *     summary: (BFF-Admin) Lấy danh sách các gói cước
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thành công.
 */
router.get('/plans', getPlans);

/**
 * @swagger
 * /bff/admin/subscriptions:
 *   get:
 *     summary: (BFF-Admin) Lấy danh sách các đăng ký của người dùng
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thành công.
 */
router.get('/subscriptions', getSubscriptions);

export default router;