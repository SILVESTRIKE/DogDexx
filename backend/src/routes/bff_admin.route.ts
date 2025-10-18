import { Router } from 'express';
import { getDashboard, getFeedback, getUsers, getModelConfig, updateModelConfig, getAlerts, updateUser, createUser, uploadModel } from '../controllers/bff_admin.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { checkAllowedRoles } from '../middlewares/role.middleware';
import { uploadModelFiles } from '../middlewares/upload.middleware';

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
 * /bff/admin/users:
 *   post:
 *     summary: (BFF) Admin tạo người dùng mới
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Tạo một tài khoản người dùng mới với các thông tin được cung cấp.
 *     responses:
 *       201:
 *         description: Tạo người dùng thành công.
 */
router.post('/users', createUser);

/**
 * @swagger
 * /bff/admin/users/{id}:
 *   put:
 *     summary: (BFF) Admin cập nhật người dùng
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     description: Cập nhật thông tin của một người dùng (username, email, role).
 *     responses:
 *       200:
 *         description: Cập nhật thành công.
 */
router.put('/users/:id', updateUser);

/**
 * @swagger
 * /bff/admin/model/config:
 *   get:
 *     summary: (BFF) Lấy cấu hình model hiện tại
 *     tags: [BFF-Admin, AI-Config]
 *     security:
 *       - bearerAuth: []
 *     description: Lấy các thông số như model, threshold từ database mà AI service đang sử dụng.
 *     responses:
 *       200:
 *         description: Lấy cấu hình thành công.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/AIConfiguration'
 *       404:
 *         description: Không tìm thấy cấu hình.
 */
router.get('/model/config', getModelConfig);

/**
 * @swagger
 * /bff/admin/model/config:
 *   put:
 *     summary: (BFF) Cập nhật cấu hình model
 *     tags: [BFF-Admin, AI-Config]
 *     security:
 *       - bearerAuth: []
 *     description: Cập nhật các tham số của AI service (threshold, device, model path) và kích hoạt việc tải lại cấu hình.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AIConfigurationUpdatePayload'
 *     responses:
 *       200:
 *         description: Cập nhật thành công.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data: { type: 'object' }
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

/**
 * @swagger
 * /bff/admin/models/upload:
 *   post:
 *     summary: (BFF) Upload a new AI model
 *     tags: [BFF-Admin, AI-Models]
 *     security:
 *       - bearerAuth: []
 *     description: Uploads a model file (.pt) and its metadata to create a new AI model record. The file is uploaded to Hugging Face.
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/AIModelUploadPayload'
 *     responses:
 *       201:
 *         description: Model uploaded and created successfully.
 */
router.post('/models/upload', uploadModelFiles, uploadModel);

export default router;
