import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { checkAllowedRoles } from '../middlewares/role.middleware';
import * as adminController from '../controllers/bff_admin.controller';
import { uploadSingle } from '../middlewares/upload.middleware';

const router = Router();

// Tất cả các route trong file này đều yêu cầu quyền admin
router.use(authMiddleware, checkAllowedRoles(['admin']));

/**
 * @swagger
 * /bff/admin/dashboard:
 *   get:
 *     summary: (BFF-Admin) Lấy dữ liệu cho trang Dashboard
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy dữ liệu dashboard thành công.
 */
router.get('/dashboard', adminController.getDashboard);

/**
 * @swagger
 * /bff/admin/feedback:
 *   get:
 *     summary: (BFF-Admin) Lấy danh sách feedback
 *     tags: [BFF-Admin]
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
 *         name: status
 *         schema: { type: string, enum: ['pending_review', 'approved_for_training', 'rejected'] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Tìm kiếm theo tên người dùng.
 *     responses:
 *       200:
 *         description: Lấy danh sách feedback thành công.
 */
router.get('/feedback', adminController.getFeedback);

/**
 * @swagger
 * /bff/admin/feedback/{id}/approve:
 *   post:
 *     summary: (BFF-Admin) Duyệt một feedback
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Duyệt feedback thành công.
 */
router.post('/feedback/:id/approve', adminController.approveFeedback);

/**
 * @swagger
 * /bff/admin/feedback/{id}/reject:
 *   post:
 *     summary: (BFF-Admin) Từ chối một feedback
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Từ chối feedback thành công.
 */
router.post('/feedback/:id/reject', adminController.rejectFeedback);

/**
 * @swagger
 * /bff/admin/users:
 *   get:
 *     summary: (BFF-Admin) Lấy danh sách người dùng
 *     tags: [BFF-Admin]
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
 *     responses:
 *       200:
 *         description: Lấy danh sách người dùng thành công.
 */
router.get('/users', adminController.getUsers);

/**
 * @swagger
 * /bff/admin/users:
 *   post:
 *     summary: (BFF-Admin) Tạo người dùng mới
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminCreateUserPayload'
 *     responses:
 *       201:
 *         description: Tạo người dùng thành công.
 */
router.post('/users', adminController.createUser);

/**
 * @swagger
 * /bff/admin/users/{id}:
 *   put:
 *     summary: (BFF-Admin) Cập nhật người dùng
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminUpdateUserPayload'
 *     responses:
 *       200:
 *         description: Cập nhật người dùng thành công.
 */
router.put('/users/:id', adminController.updateUser);

/**
 * @swagger
 * /bff/admin/model/config:
 *   get:
 *     summary: (BFF-Admin) Lấy danh sách model và cấu hình AI
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thành công.
 */
router.get('/model/config', adminController.getAIModelsAndConfigs);

/**
 * @swagger
 * /bff/admin/model/config:
 *   put:
 *     summary: (BFF-Admin) Cập nhật cấu hình hoặc kích hoạt model AI
 *     tags: [BFF-Admin]
 *     security:
ax- bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               modelId:
 *                 type: string
 *                 description: ID của model để kích hoạt.
 *               configId:
 *                 type: string
 *                 description: ID của cấu hình để cập nhật.
 *               image_conf:
 *                 type: number
 *               video_conf:
 *                 type: number
 *     responses:
 *       200:
 *         description: Cập nhật và reload service thành công.
 */
router.put('/model/config', adminController.updateModelConfig);

/**
 * @swagger
 * /bff/admin/models/upload:
 *   post:
 *     summary: (BFF-Admin) Tải lên một model AI mới
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/CreateAIModelPayload'
 *     responses:
 *       201:
 *         description: Tải lên và tạo model thành công.
 */
router.post('/models/upload', uploadSingle, adminController.uploadModel);

/**
 * @swagger
 * /bff/admin/histories:
 *   get:
 *     summary: (BFF-Admin) Lấy lịch sử dự đoán
 *     tags: [BFF-Admin]
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
 *     responses:
 *       200:
 *         description: Lấy lịch sử thành công.
 */
router.get('/histories', adminController.getHistories);

/**
 * @swagger
 * /bff/admin/histories/browse:
 *   get:
 *     summary: (BFF-Admin) Duyệt lịch sử dự đoán theo thư mục
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: path
 *         schema: { type: string }
 *         description: "Đường dẫn thư mục ảo (ví dụ: 'username/images')."
 *     responses:
 *       200:
 *         description: Lấy nội dung thư mục thành công.
 */
router.get('/histories/browse', adminController.browseHistories);

/**
 * @swagger
 * /bff/admin/media/browse:
 *   get:
 *     summary: (BFF-Admin) Duyệt media theo thư mục
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: path
 *         schema: { type: string }
 *         description: "Đường dẫn thư mục ảo (ví dụ: 'username/images')."
 *     responses:
 *       200:
 *         description: Lấy nội dung media thành công.
 */
router.get('/media/browse', adminController.browseMedia);

/**
 * @swagger
 * /bff/admin/plans:
 *   get:
 *     summary: (BFF-Admin) Lấy danh sách tất cả các gói cước
 *     tags: [BFF-Admin-Plans]
 *     description: Lấy danh sách tất cả các gói cước hiện có trong hệ thống.
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
 *     responses:
 *       200:
 *         description: Lấy danh sách gói cước thành công.
 */
router.get('/plans', adminController.getPlans);

/**
 * @swagger
 * /bff/admin/plans:
 *   post:
 *     summary: (BFF-Admin) Tạo một gói cước mới
 *     tags: [BFF-Admin-Plans]
 *     description: Tạo một gói cước mới với các thông số chi tiết.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlanCreatePayload'
 *     responses:
 *       201:
 *         description: Tạo gói cước thành công.
 *       400:
 *         description: Dữ liệu không hợp lệ.
 */
router.post('/plans', adminController.createPlan);

/**
 * @swagger
 * /bff/admin/plans/{id}:
 *   put:
 *     summary: (BFF-Admin) Cập nhật một gói cước theo ID
 *     tags: [BFF-Admin-Plans]
 *     description: Cập nhật thông tin chi tiết của một gói cước đã tồn tại.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của gói cước cần cập nhật.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PlanUpdatePayload'
 *     responses:
 *       200:
 *         description: Cập nhật gói cước thành công.
 *       404:
 *         description: Không tìm thấy gói cước.
 */
router.put('/plans/:id', adminController.updatePlan);

/**
 * @swagger
 * /bff/admin/plans/{id}:
 *   delete:
 *     summary: (BFF-Admin) Xóa một gói cước theo ID
 *     tags: [BFF-Admin-Plans]
 *     description: Xóa (mềm) một gói cước khỏi hệ thống.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của gói cước cần xóa.
 *     responses:
 *       200:
 *         description: Xóa gói cước thành công.
 *       404:
 *         description: Không tìm thấy gói cước.
 */
router.delete('/plans/:id', adminController.deletePlan);

/**
 * @swagger
 * /bff/admin/wiki:
 *   get:
 *     summary: (BFF-Admin) Lấy danh sách các bài viết trong Wiki
 *     tags: [BFF-Admin-Wiki]
 *     description: Lấy danh sách phân trang các giống chó trong Wiki.
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
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công.
 */
router.get('/wiki', adminController.getWikiBreeds);

/**
 * @swagger
 * /bff/admin/wiki:
 *   post:
 *     summary: (BFF-Admin) Tạo một bài viết Wiki mới
 *     tags: [BFF-Admin-Wiki]
 *     description: Tạo một bài viết mới về giống chó, có thể đính kèm ảnh.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/DogBreedWikiCreatePayload' # Cần định nghĩa schema này
 *     responses:
 *       201:
 *         description: Tạo bài viết thành công.
 */
router.post('/wiki', adminController.createWikiBreed);

/**
 * @swagger
 * /bff/admin/wiki/{slug}:
 *   put:
 *     summary: (BFF-Admin) Cập nhật một bài viết Wiki
 *     tags: [BFF-Admin-Wiki]
 *     description: Cập nhật thông tin một bài viết về giống chó.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/DogBreedWikiUpdatePayload' # Cần định nghĩa schema này
 *     responses:
 *       200:
 *         description: Cập nhật thành công.
 */
router.put('/wiki/:slug', adminController.updateWikiBreed);

/**
 * @swagger
 * /bff/admin/wiki/{slug}:
 *   delete:
 *     summary: (BFF-Admin) Xóa (mềm) một bài viết Wiki
 *     tags: [BFF-Admin-Wiki]
 *     description: Xóa mềm một bài viết về giống chó.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Xóa thành công.
 */
router.delete('/wiki/:slug', adminController.deleteWikiBreed);

/**
 * @swagger
 * /bff/admin/subscriptions:
 *   get:
 *     summary: (BFF-Admin) Lấy danh sách các đăng ký
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách đăng ký thành công.
 */
router.get('/subscriptions', adminController.getSubscriptions);

/**
 * @swagger
 * /bff/admin/transactions:
 *   get:
 *     summary: (BFF-Admin) Lấy danh sách các giao dịch
 *     tags: [BFF-Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách giao dịch thành công.
 */
router.get('/transactions', adminController.getTransactions);

export default router;