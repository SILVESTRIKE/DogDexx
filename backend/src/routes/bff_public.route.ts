import { Router } from 'express';
import { bffPublicController } from '../controllers/bff_public.controller';

const router = Router();

/**
 * @swagger
 * /bff/public/plans:
 *   get:
 *     summary: "(BFF) Lấy danh sách các gói cước công khai"
 *     tags: [BFF-Public]
 *     description: Lấy danh sách tất cả các gói cước được đánh dấu là công khai để hiển thị trên trang giá.
 *     responses:
 *       200:
 *         description: Trả về danh sách các gói cước.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Plan'
 */
router.get('/plans', bffPublicController.getPublicPlans);

/**
 * @swagger
 * /bff/public/plans/{slug}:
 *   get:
 *     summary: "(BFF) Lấy chi tiết một gói cước công khai bằng slug"
 *     tags: [BFF-Public]
 *     description: Lấy thông tin chi tiết của một gói cước cụ thể dựa trên slug của nó.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trả về chi tiết gói cước.
 */
router.get('/plans/:slug', bffPublicController.getPublicPlanBySlug);

/**
 * @swagger
 * /bff/public/contact:
 *   post:
 *     summary: "(BFF) Gửi form liên hệ"
 *     tags: [BFF-Public]
 *     description: Người dùng gửi phản hồi hoặc liên hệ qua form. Yêu cầu xác thực reCAPTCHA.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ContactPayload' # Bạn cần định nghĩa schema này trong file swagger
 *     responses:
 *       200:
 *         description: Gửi liên hệ thành công.
 */
router.post('/contact', bffPublicController.handleContactForm);

/**
 * @swagger
 * /bff/public/leaderboard:
 *   get:
 *     tags: [BFF-Public]
 *     summary: Xem bảng xếp hạng
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { enum: [global, country, city] }
 *       - in: query
 *         name: value
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: OK
 */
router.get('/leaderboard',  bffPublicController.getLeaderboard);

/**
 * @swagger
 * /bff/public/leaderboard/locations:
 *   get:
 *     tags: [BFF-Public]
 *     summary: Lấy danh sách địa điểm để lọc
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema: { enum: [country, city] }
 */
router.get('/leaderboard/locations',  bffPublicController.getLeaderboardLocations);

export default router;