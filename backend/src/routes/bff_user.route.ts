import { Router } from 'express';
import {
    register,
    login,
    getProfile,
    updateProfile,
    logout,
    verifyOtp,
    refreshToken,
    updateAvatar,
    createCheckoutSession,
    getSessionStatus,
    handleMomoIpn,
    forgotPassword,
    resetPassword,
    deleteCurrentUser,
    cancelSubscription
} from '../controllers/bff_user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateData } from '../middlewares/validateBody.middleware';
import { LoginPayloadSchema } from '../types/zod/auth.zod';
import { uploadAvatar } from '../middlewares/upload.middleware';
import { ForgotPasswordSchema, ResetPasswordSchema } from '../types/zod/user.zod';
import { optionalAuthMiddleware } from '../middlewares/optionalAuth.middleware';

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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: File ảnh đại diện (tùy chọn).
 *     responses:
 *       201:
 *         description: Đăng ký thành công, chờ xác thực OTP.
 */
// THAY ĐỔI: Đã xóa `validateData(...)` ra khỏi dòng này
router.post('/register', uploadAvatar, register);

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
router.post('/login', validateData(LoginPayloadSchema, 'body'), login);

/**
 * @swagger
 * /bff/user/verify-otp:
 *   post:
 *     summary: (BFF) Xác thực OTP
 *     tags: [BFF-User]
 *     description: Xác thực mã OTP được gửi đến email người dùng sau khi đăng ký.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Xác thực thành công.
 */
router.post('/verify-otp', verifyOtp);

/**
 * @swagger
 * /bff/user/forgot-password:
 *   post:
 *     summary: (BFF) Gửi mã reset mật khẩu
 *     tags: [BFF-User]
 *     description: Gửi mã OTP để reset mật khẩu về email.
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
 *     responses:
 *       200:
 *         description: Mã đã được gửi.
 */
router.post('/forgot-password', validateData(ForgotPasswordSchema.shape.body, 'body'), forgotPassword);

/**
 * @swagger
 * /bff/user/reset-password:
 *   post:
 *     summary: (BFF) Đặt lại mật khẩu bằng OTP
 *     tags: [BFF-User]
 *     description: Đặt mật khẩu mới sử dụng mã OTP gửi tới email.
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
 *               otp:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Mật khẩu đã được reset.
 */
router.post('/reset-password', validateData(ResetPasswordSchema.shape.body, 'body'), resetPassword);

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
 *     description: Cập nhật thông tin cá nhân của người dùng (username, firstName, lastName) và/hoặc ảnh đại diện.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: Tên người dùng mới.
 *               firstName:
 *                 type: string
 *                 description: Họ mới.
 *               lastName:
 *                 type: string
 *                 description: Tên mới.
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: File ảnh đại diện mới (tùy chọn).
 *     responses:
 *       200:
 *         description: Cập nhật thành công.
 *       400:
 *         description: Dữ liệu không hợp lệ.
 *       401:
 *         description: Chưa xác thực.
 */
// Force restart
router.put('/profile', authMiddleware, uploadAvatar, updateProfile);

/**
 * @swagger
 * /bff/user/profile:
 *   delete:
 *     summary: (BFF) Xóa tài khoản hiện tại
 *     tags: [BFF-User]
 *     security:
 *       - bearerAuth: []
 *     description: Xóa tài khoản người dùng hiện tại. Hành động này sẽ xóa dữ liệu người dùng theo chính sách xóa của hệ thống.
 *     responses:
 *       200:
 *         description: Tài khoản đã được xóa thành công.
 *       400:
 *         description: Mật khẩu không chính xác.
 */
router.delete('/profile', authMiddleware, deleteCurrentUser);

/**
 * @swagger
 * /bff/user/avatar:
 *   put:
 *     summary: (BFF) Cập nhật ảnh đại diện
 *     tags: [BFF-User]
 *     security:
 *       - bearerAuth: []
 *     description: Tải lên và thay đổi ảnh đại diện của người dùng. Avatar cũ sẽ được đánh dấu xóa.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Cập nhật ảnh đại diện thành công.
 */
router.post('/avatar', authMiddleware, uploadAvatar, updateAvatar);

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

/**
 * @swagger
 * /bff/user/refresh:
 *   post:
 *     summary: (BFF) Làm mới access token
 *     tags: [BFF-User]
 *     description: Sử dụng refresh token để lấy một cặp access token và refresh token mới.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenPayload'
 *     responses:
 *       200:
 *         description: Làm mới token thành công.
 */
router.post('/refresh', refreshToken);

/**
 * @swagger
 * /bff/user/create-checkout-session:
 *   post:
 *     summary: (BFF) Tạo phiên thanh toán để nâng cấp gói
 *     tags: [BFF-User]
 *     security:
 *       - bearerAuth: []
 *     description: Tạo một phiên thanh toán (ví dụ Stripe) để người dùng có thể nâng cấp gói cước.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               planId:
 *                 type: string
 *                 description: "ID (slug) của gói cước muốn nâng cấp (ví dụ: 'starter', 'professional')."
 *               billingPeriod:
 *                 type: string
 *                 enum: [monthly, yearly]
 *     responses:
 *       200:
 *         description: Trả về URL của phiên thanh toán để redirect người dùng.
 */
router.post('/create-checkout-session', authMiddleware, createCheckoutSession);

router.post('/cancel-subscription', authMiddleware, cancelSubscription);

/**
 * @route GET /bff/user/session-status
 * @desc Kiểm tra trạng thái phiên của người dùng.
 * - Nếu đã đăng nhập, trả về thông tin user đầy đủ (tương tự /profile).
 * - Nếu là khách, khởi tạo hoặc lấy thông tin phiên dùng thử.
 * @access Public
 */
router.get('/session-status', optionalAuthMiddleware, getSessionStatus);

router.post('/momo-ipn', handleMomoIpn);

export default router;