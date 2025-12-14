import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validation.middleware";
import { createPostSchema, updatePostSchema } from "../utils/validation";
import {
    createPost,
    getPosts,
    getPost,
    updatePost,
    deletePost,
    resolvePost,
    getRadar,
    uploadPostImages
} from "../controllers/bff_post.controller";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: BFF-Post
 *   description: API quản lý bài đăng cộng đồng (Lost & Found)
 */

/**
 * @swagger
 * /bff/post:
 *   get:
 *     summary: Lấy danh sách bài đăng cộng đồng
 *     tags: [BFF-Post]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [LOST, FOUND]
 *         description: Lọc theo loại bài đăng
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, resolved]
 *         description: Lọc theo trạng thái
 *       - in: query
 *         name: breed
 *         schema:
 *           type: string
 *         description: Lọc theo giống chó
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Vĩ độ để tìm kiếm theo vị trí
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Kinh độ để tìm kiếm theo vị trí
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *         description: Bán kính tìm kiếm (km)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Danh sách bài đăng
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     type: object
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 */
router.get("/", getPosts);

/**
 * @swagger
 * /bff/post/radar:
 *   get:
 *     summary: Lấy dữ liệu radar cho bản đồ
 *     tags: [BFF-Post]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [LOST, FOUND]
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *         description: Bán kính (km), mặc định 50
 *     responses:
 *       200:
 *         description: Dữ liệu vị trí các bài đăng cho bản đồ
 */
router.get("/radar", getRadar);

/**
 * @swagger
 * /bff/post/{id}:
 *   get:
 *     summary: Lấy chi tiết một bài đăng
 *     tags: [BFF-Post]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của bài đăng
 *     responses:
 *       200:
 *         description: Chi tiết bài đăng
 *       404:
 *         description: Không tìm thấy bài đăng
 */
router.get("/:id", getPost);

/**
 * @swagger
 * /bff/post:
 *   post:
 *     summary: Tạo bài đăng mới
 *     tags: [BFF-Post]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - breed
 *               - description
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [LOST, FOUND]
 *               breed:
 *                 type: string
 *               description:
 *                 type: string
 *               location:
 *                 type: string
 *                 description: JSON string của location object {lat, lng, address}
 *               contactName:
 *                 type: string
 *               contactPhone:
 *                 type: string
 *               contactEmail:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Tạo bài đăng thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 */
router.post("/", authMiddleware, uploadPostImages, validate(createPostSchema, "body"), createPost);

/**
 * @swagger
 * /bff/post/{id}:
 *   put:
 *     summary: Cập nhật bài đăng
 *     tags: [BFF-Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               location:
 *                 type: object
 *               contactName:
 *                 type: string
 *               contactPhone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy bài đăng
 */
router.put("/:id", authMiddleware, validate(updatePostSchema, "body"), updatePost);

/**
 * @swagger
 * /bff/post/{id}:
 *   delete:
 *     summary: Xóa bài đăng
 *     tags: [BFF-Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy bài đăng
 */
router.delete("/:id", authMiddleware, deletePost);

/**
 * @swagger
 * /bff/post/{id}/resolve:
 *   patch:
 *     summary: Đánh dấu bài đăng đã giải quyết (tìm thấy chó)
 *     tags: [BFF-Post]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Đã đánh dấu thành công
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy bài đăng
 */
router.patch("/:id/resolve", authMiddleware, resolvePost);

export default router;
