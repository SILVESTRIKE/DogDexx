import { Router } from 'express';
import { register, login, getProfile, updateProfile, logout } from '../controllers/bff_user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /bff/user/register:
 *   post:
 *     summary: (BFF) Đăng ký tài khoản mới
 *     tags: [BFF-User]
 *     description: Tạo tài khoản người dùng, thư mục cá nhân và gửi OTP xác thực.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: Đăng ký thành công, chờ xác thực OTP.
 */
router.post('/register', register);

/**
 * @swagger
 * /bff/user/login:
 *   post:
 *     summary: (BFF) Đăng nhập và lấy dữ liệu ban đầu
 *     tags: [BFF-User]
 *     description: Đăng nhập, trả về thông tin user, tokens và bộ sưu tập của người dùng.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về dữ liệu tổng hợp.
 */
router.post('/login', login);

/**
 * @swagger
 * /bff/user/profile:
 *   get:
 *     summary: (BFF) Lấy thông tin hồ sơ tổng hợp
 *     tags: [BFF-User]
 *     security:
 *       - bearerAuth: []
 *     description: Lấy thông tin user, bộ sưu tập và lịch sử dự đoán gần đây.
 *     responses:
 *       200:
 *         description: Lấy hồ sơ thành công.
 */
router.get('/profile', authMiddleware, getProfile);

/**
 * @swagger
 * /bff/user/profile:
 *   put:
 *     summary: (BFF) Cập nhật hồ sơ người dùng
 *     tags: [BFF-User]
 *     security:
 *       - bearerAuth: []
 *     description: Cập nhật thông tin cá nhân của người dùng.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công.
 */
router.put('/profile', authMiddleware, updateProfile);

/**
 * @swagger
 * /bff/user/logout:
 *   post:
 *     summary: (BFF) Đăng xuất
 *     tags: [BFF-User]
 *     description: Vô hiệu hóa refresh token.
 *     responses:
 *       200:
 *         description: Đăng xuất thành công.
 */
router.post('/logout', logout);

export default router;
