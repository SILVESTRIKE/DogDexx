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

export default router;