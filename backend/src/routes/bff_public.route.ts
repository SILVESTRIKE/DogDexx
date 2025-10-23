import { Router } from 'express';
import { getPublicPlans } from '../controllers/bff_public.controller';

const router = Router();

/**
 * @swagger
 * /bff/public/plans:
 *   get:
 *     summary: (BFF-Public) Lấy danh sách các gói cước công khai
 *     tags: [BFF-Public]
 *     description: Endpoint công khai để lấy danh sách các gói cước hiển thị trên trang giá.
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thành công.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 */
router.get('/plans', getPublicPlans);

export default router;