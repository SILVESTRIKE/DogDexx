import { Router } from 'express';
import { getPokedex, addBreed, getAchievements, getStats } from '../controllers/bff_collection.controller';

const router = Router();

router.get('/pokedex', getPokedex);
router.post('/add/:slug', addBreed);
/**
 * @swagger
 * /bff/collection/achievements:
 *   get:
 *     summary: Lấy danh sách achievements của user
 *     tags:
 *       - Achievements
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của user
 *     responses:
 *       200:
 *         description: Danh sách achievements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 achievements:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Thiếu userId
 *       500:
 *         description: Lỗi server
 */
router.get('/achievements', getAchievements);
router.get('/stats', getStats);

export default router;
