import { Router } from "express";
import {
  MediaController,
  DirectoryController,
} from "../controllers/medias.controller";
import { validate } from "../middlewares/validation.middleware";
import {
  UpdateMediaInfoZodSchema,
  CreateDirectoryZodSchema,
  GetByIdParamsSchema,
  GetMediasQuerySchema,
  RenameDirectoryZodSchema,
  MoveDirectoryZodSchema,
} from "../types/zod/medias.zod";
import { uploadSingle, uploadMultiple } from "../middlewares/upload.middleware"; // Giả sử bạn có file này
import { authMiddleware } from "../middlewares/auth.middleware";
import { deleteMedia as adminDeleteMedia } from '../controllers/bff_admin.controller';
import { bffPredictionController } from '../controllers/bff_prediction.controller';
import { checkAllowedRoles } from "../middlewares/role.middleware"
const router = Router();

// =================================================================
// I. MEDIA UPLOAD ROUTES
// =================================================================

/**
 * @swagger
 * /api/medias/upload/single:
 *   post:
 *     summary: Upload một file media
 *     description: Upload một file media và trả về metadata đầy đủ.
 *     tags: [Medias]
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
 *         description: Media được upload thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaResponse'
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
router.post(
  "/api/medias/upload/single",
  authMiddleware,
  uploadSingle,
  MediaController.uploadSingle
);

/**
 * @swagger
 * /api/medias/upload/multiple:
 *   post:
 *     summary: Upload nhiều file media
 *     description: Upload nhiều file media và trả về mảng metadata.
 *     tags: [Medias]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Các media được upload thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MediaResponse'
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
router.post(
  "/api/medias/upload/multiple",
  authMiddleware,
  uploadMultiple,
  MediaController.uploadMultiple
);

/**
 * @swagger
 * /api/medias/upload-url:
 *   post:
 *     summary: Upload một file và lấy URL
 *     description: Upload một file media và chỉ trả về URL của file (dùng cho editor).
 *     tags: [Medias]
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
 *         description: URL của media
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   example: /uploads/media/123456.jpg
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
router.post(
  "/api/medias/upload-url",
  authMiddleware,
  uploadSingle,
  MediaController.uploadAndGetUrl
);

// =================================================================
// II. MEDIA ACCESS & MANAGEMENT ROUTES
// =================================================================

/**
 * @swagger
 * /api/medias:
 *   get:
 *     summary: Lấy danh sách media
 *     description: Lấy danh sách media với hỗ trợ lọc theo thuộc tính, thư mục logic và thời gian.
 *     tags: [Medias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: directory_id
 *         schema:
 *           type: string
 *         description: ID của thư mục logic
 *     responses:
 *       200:
 *         description: Danh sách media
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
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
router.get(
  "/api/medias",
  validate(GetMediasQuerySchema, "query"),
  MediaController.getMedias
);

/**
 * @swagger
 * /api/medias/{id}:
 *   get:
 *     summary: Lấy thông tin chi tiết của một media
 *     description: Lấy thông tin chi tiết của một media dựa trên ID.
 *     tags: [Medias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của media
 *     responses:
 *       200:
 *         description: Thông tin chi tiết media
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaResponse'
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
 *       404:
 *         description: Không tìm thấy media
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/api/medias/:id",
  validate(GetByIdParamsSchema, "params"),
  MediaController.getMediaById
);

/**
 * @swagger
 * /api/medias/{id}:
 *   patch:
 *     summary: Cập nhật thông tin media
 *     description: Cập nhật thông tin (tên, mô tả) của một media dựa trên ID.
 *     tags: [Medias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của media
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MediaCreatePayload'
 *     responses:
 *       200:
 *         description: Media được cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaResponse'
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
 *       404:
 *         description: Không tìm thấy media
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  "/api/medias/:id",
  authMiddleware,
  validate(GetByIdParamsSchema, "params"),
  validate(UpdateMediaInfoZodSchema, "body"),
  MediaController.updateMediaInfo
);

/**
 * @swagger
 * /api/medias/{id}:
 *   delete:
 *     summary: Xóa mềm một media
 *     description: Xóa mềm một media dựa trên ID.
 *     tags: [Medias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của media
 *     responses:
 *       200:
 *         description: Media được xóa mềm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Media đã được xóa mềm thành công
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
 *       404:
 *         description: Không tìm thấy media
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  "/api/medias/:id",
  authMiddleware,
  validate(GetByIdParamsSchema, "params"),
  MediaController.deleteMedia
);

// =================================================================
// III. DIRECTORY (LOGICAL FOLDERS) MANAGEMENT ROUTES
// =================================================================

/**
 * @swagger
 * /api/directories:
 *   post:
 *     summary: Tạo một thư mục logic mới
 *     description: Tạo một thư mục logic mới để quản lý media.
 *     tags: [Directories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DirectoryCreatePayload'
 *     responses:
 *       201:
 *         description: Thư mục được tạo thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DirectoryResponse'
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
router.post(
  "/api/directories",
  authMiddleware,
  validate(CreateDirectoryZodSchema, "body"),
  DirectoryController.create
);

/**
 * @swagger
 * /api/directories:
 *   get:
 *     summary: Lấy danh sách tất cả thư mục logic
 *     description: Lấy danh sách tất cả các thư mục logic của người dùng.
 *     tags: [Directories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách thư mục logic
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DirectoryResponse'
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
router.get(
  "/api/directories",
  authMiddleware,
  DirectoryController.getAll
);

/**
 * @swagger
 * /api/directories/content:
 *   get:
 *     summary: Lấy nội dung của thư mục gốc
 *     description: Lấy nội dung (media và thư mục con) của thư mục gốc.
 *     tags: [Directories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Nội dung thư mục gốc
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 directories:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DirectoryResponse'
 *                 medias:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MediaResponse'
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
router.get(
  "/api/directories/content",
  authMiddleware,
  DirectoryController.getContent
);

/**
 * @swagger
 * /api/directories/content/{id}:
 *   get:
 *     summary: Lấy nội dung của một thư mục logic
 *     description: Lấy nội dung (media và thư mục con) của một thư mục logic cụ thể dựa trên ID.
 *     tags: [Directories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của thư mục logic
 *     responses:
 *       200:
 *         description: Nội dung thư mục logic
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 directories:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DirectoryResponse'
 *                 medias:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MediaResponse'
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
 *       404:
 *         description: Không tìm thấy thư mục
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/api/directories/content/:id",
  authMiddleware,
  validate(GetByIdParamsSchema, "params"),
  DirectoryController.getContent
);

/**
 * @swagger
 * /api/directories/{id}/breadcrumb:
 *   get:
 *     summary: Lấy đường dẫn breadcrumb cho một thư mục
 *     description: Lấy đường dẫn breadcrumb cho một thư mục logic dựa trên ID.
 *     tags: [Directories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của thư mục logic
 *     responses:
 *       200:
 *         description: Đường dẫn breadcrumb
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DirectoryResponse'
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
 *       404:
 *         description: Không tìm thấy thư mục
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/api/directories/:id/breadcrumb",
  authMiddleware,
  validate(GetByIdParamsSchema, "params"),
  DirectoryController.getBreadcrumb
);

/**
 * @swagger
 * /api/directories/{id}:
 *   delete:
 *     summary: Xóa mềm một thư mục logic
 *     description: Xóa mềm một thư mục logic và toàn bộ nội dung bên trong nó (đệ quy).
 *     tags: [Directories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của thư mục logic
 *     responses:
 *       200:
 *         description: Thư mục được xóa mềm thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Thư mục đã được xóa mềm thành công
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
 *       404:
 *         description: Không tìm thấy thư mục
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  "/api/directories/:id",
  authMiddleware,
  validate(GetByIdParamsSchema, "params"),
  DirectoryController.softDelete
);

/**
 * @swagger
 * /api/directories/{id}/rename:
 *   patch:
 *     summary: Đổi tên một thư mục logic
 *     description: Đổi tên một thư mục logic dựa trên ID.
 *     tags: [Directories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của thư mục logic
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DirectoryCreatePayload'
 *     responses:
 *       200:
 *         description: Thư mục được đổi tên thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DirectoryResponse'
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
 *       404:
 *         description: Không tìm thấy thư mục
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  "/api/directories/:id/rename",
  authMiddleware,
  validate(GetByIdParamsSchema, "params"),
  validate(RenameDirectoryZodSchema, "body"),
  DirectoryController.rename
);

/**
 * @swagger
 * /api/directories/{id}/move:
 *   patch:
 *     summary: Di chuyển một thư mục logic
 *     description: Di chuyển một thư mục logic sang một thư mục cha khác.
 *     tags: [Directories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của thư mục logic
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DirectoryCreatePayload'
 *     responses:
 *       200:
 *         description: Thư mục được di chuyển thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DirectoryResponse'
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
 *       404:
 *         description: Không tìm thấy thư mục
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  "/api/directories/:id/move",
  authMiddleware,
  validate(GetByIdParamsSchema, "params"),
  validate(MoveDirectoryZodSchema, "body"),
  DirectoryController.move
);

// =================================================================
// IV. PHYSICAL FOLDER BROWSING ROUTES (ADMIN ONLY)
// =================================================================

/**
 * @swagger
 * /api/admin/media-folders:
 *   get:
 *     summary: Lấy danh sách các thư mục loại file
 *     description: Lấy danh sách các thư mục loại file (chỉ dành cho admin).
 *     tags: [Medias]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách các thư mục loại file
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
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
router.get(
  "/api/admin/media-folders",
  authMiddleware,
  MediaController.getFileTypeFolders
);

/**
 * @swagger
 * /api/admin/media-folders/{fileType}:
 *   get:
 *     summary: Lấy danh sách các thư mục năm
 *     description: Lấy danh sách các thư mục năm có chứa media cho một loại file cụ thể (chỉ dành cho admin).
 *     tags: [Medias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileType
 *         schema:
 *           type: string
 *         required: true
 *         description: "Loại file (ví dụ: image, video)"
 *     responses:
 *       200:
 *         description: Danh sách các thư mục năm
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
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
router.get(
  "/api/admin/media-folders/:fileType",
  authMiddleware,
  MediaController.getYearFolders
);

/**
 * @swagger
 * /api/admin/media-folders/{fileType}/{year}:
 *   get:
 *     summary: Lấy danh sách các thư mục tháng
 *     description: Lấy danh sách các thư mục tháng trong một năm cho một loại file cụ thể (chỉ dành cho admin).
 *     tags: [Medias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileType
 *         schema:
 *           type: string
 *         required: true
 *         description: "Loại file (ví dụ: image, video)"
 *       - in: path
 *         name: year
 *         schema:
 *           type: string
 *         required: true
 *         description: Năm của thư mục
 *     responses:
 *       200:
 *         description: Danh sách các thư mục tháng
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
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
router.get(
  "/api/admin/media-folders/:fileType/:year",
  authMiddleware,
  MediaController.getMonthFolders
);

/**
 * @swagger
 * /api/admin/media-folders/{fileType}/{year}/{month}:
 *   get:
 *     summary: Lấy danh sách media trong thư mục tháng/năm
 *     description: Lấy danh sách media trong một thư mục tháng/năm cụ thể (chỉ dành cho admin).
 *     tags: [Medias]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileType
 *         schema:
 *           type: string
 *         required: true
 *         description: "Loại file (ví dụ: image, video)"
 *       - in: path
 *         name: year
 *         schema:
 *           type: string
 *         required: true
 *         description: Năm của thư mục
 *       - in: path
 *         name: month
 *         schema:
 *           type: string
 *         required: true
 *         description: Tháng của thư mục
 *     responses:
 *       200:
 *         description: Danh sách media
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MediaResponse'
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
router.get(
  "/api/admin/media-folders/:fileType/:year/:month",
  authMiddleware,
  MediaController.getMediaByPhysicalPath
);

// Route mới cho admin xóa media
router.delete(
  "/bff/admin/media/:id",
  authMiddleware, // Đảm bảo đã đăng nhập
  checkAllowedRoles(['admin']), // Chỉ cho phép admin
  adminDeleteMedia
);

// Route for user to delete their own prediction history
router.delete(
  "/bff/predict/history/:id",
  authMiddleware,
  validate(GetByIdParamsSchema, "params"),
  bffPredictionController.deletePredictionHistory
);

export { router as mediasRouter };