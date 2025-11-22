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
  deleteUser,
  getModelConfig,
  updateModelConfig,
  getAlerts,
  uploadModel,
  getUsageStats,
  getHistories,
  browseMedia,
  deleteMedia,
  getPlans,
  getSubscriptions,
  browseHistories,
  createPlan,
  updatePlan,
  deletePlan,
  getTransactions,
  getWikiBreeds,
  createWikiBreed,
  updateWikiBreed,
  deleteWikiBreed,
  getAIModels,
  activateAIModel,
  browseDatasets,
  downloadDataset,
  exportReport,
  getReportPreview,
} from '../controllers/bff_admin.controller';
import { uploadSingle, uploadModelFiles } from '../middlewares/upload.middleware';

const router = Router();

// Tất cả các route trong file này đều yêu cầu quyền admin
router.use(authMiddleware, checkAllowedRoles(['admin']));

router.get('/dashboard', getDashboard);
router.get('/feedback', getFeedback);
router.post('/feedback/:id/approve', approveFeedback);
router.post('/feedback/:id/reject', rejectFeedback);
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);
router.get('/model/config', getModelConfig);
router.put('/model/config', updateModelConfig);
router.get('/alerts', getAlerts);
router.post('/models/upload', uploadModelFiles, uploadModel); // Giả sử uploadSingle là middleware phù hợp
router.get('/usage', getUsageStats);
router.get('/histories', getHistories);
router.get('/histories/browse', browseHistories);
router.get('/media/browse', browseMedia);

/**
 * @swagger
 * /bff/admin/media/{id}:
 *   delete:
 *     summary: (BFF-Admin) Xóa một media file
 *     tags: [BFF-Admin-Media]
 *     description: Xóa vĩnh viễn một media file và các bản ghi lịch sử, feedback liên quan.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID của media cần xóa.
 *     responses:
 *       200: { description: Xóa thành công. }
 *       404: { description: Không tìm thấy media. }
 */
router.delete('/media/:id', deleteMedia);

// --- THAY ĐỔI: THÊM CÁC ENDPOINT MỚI ĐỂ QUẢN LÝ PLANS ---

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
router.get('/plans', getPlans);

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
router.post('/plans', createPlan);

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
router.put('/plans/:id', updatePlan);

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
router.delete('/plans/:id', deletePlan);

// --- THÊM MỚI: CÁC ENDPOINT ĐỂ QUẢN LÝ WIKI ---

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
router.get('/wiki', getWikiBreeds);

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
router.post('/wiki', createWikiBreed); // Sử dụng middleware upload riêng cho wiki

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
router.put('/wiki/:slug', updateWikiBreed);

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
router.delete('/wiki/:slug', deleteWikiBreed);

// --- THÊM MỚI: CÁC ENDPOINT ĐỂ QUẢN LÝ AI MODELS ---

/**
 * @swagger
 * /bff/admin/ai-models:
 *   get:
 *     summary: (BFF-Admin) Lấy danh sách tất cả AI models
 *     tags: [BFF-Admin-AI-Models]
 *     description: Lấy danh sách tất cả các AI model có trong hệ thống.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công.
 */
router.get('/ai-models', getAIModels);

/**
 * @swagger
 * /bff/admin/ai-models/{id}/activate:
 *   post:
 *     summary: (BFF-Admin) Kích hoạt một AI model
 *     tags: [BFF-Admin-AI-Models]
 *     description: Kích hoạt một model và vô hiệu hóa các model khác cùng tác vụ.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Kích hoạt thành công.
 */
router.post('/ai-models/:id/activate', activateAIModel);

// --- THÊM MỚI: CÁC ENDPOINT ĐỂ QUẢN LÝ DATASET ---

/**
 * @swagger
 * /bff/admin/datasets/browse:
 *   get:
 *     summary: (BFF-Admin) Duyệt thư mục dataset
 *     tags: [BFF-Admin-Datasets]
 *     description: Duyệt cây thư mục dataset vật lý trên server.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: path
 *         schema: { type: string, default: "" }
 *         description: Đường dẫn tương đối bên trong thư mục dataset.
 *     responses:
 *       200: { description: Lấy nội dung thư mục thành công. }
 */
router.get('/datasets/browse', browseDatasets);

/**
 * @swagger
 * /bff/admin/datasets/download:
 *   get:
 *     summary: (BFF-Admin) Tải về toàn bộ dataset
 *     tags: [BFF-Admin-Datasets]
 *     description: Tải về toàn bộ thư mục dataset dưới dạng file .zip.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bắt đầu tải file zip.
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/datasets/download', downloadDataset);

// --- THÊM MỚI: ENDPOINT ĐỂ XUẤT BÁO CÁO ---

/**
 * @swagger
 * /bff/admin/reports/export:
 *   get:
 *     summary: (BFF-Admin) Xuất báo cáo hoạt động
 *     tags: [BFF-Admin-Reports]
 *     description: Tạo và tải về file báo cáo (Excel hoặc Word) trong một khoảng thời gian.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         required: true
 *         schema: { type: string, enum: [excel, word] }
 *         description: Định dạng file báo cáo.
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Bắt đầu tải file báo cáo.
 */
router.get('/reports/export', exportReport);
// --- THÊM MỚI: ENDPOINT ĐỂ XEM TRƯỚC BÁO CÁO ---
/**
 * @swagger
 * /bff/admin/reports/preview:
 *   get:
 *     summary: (BFF-Admin) Xem trước số liệu báo cáo
 *     tags: [BFF-Admin-Reports]
 *     description: Trả về dữ liệu JSON thống kê để hiển thị biểu đồ trước khi xuất file.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Trả về JSON dữ liệu báo cáo.
 */
router.get('/reports/preview', getReportPreview); // <--- Đăng ký route ở đây

// --- CÁC ROUTE CÒN LẠI GIỮ NGUYÊN ---
router.get('/subscriptions', getSubscriptions);
router.get('/transactions', getTransactions);


export default router;