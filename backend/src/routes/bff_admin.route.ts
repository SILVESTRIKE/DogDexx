import { Router } from 'express';
import { getDashboard, getFeedback, getUsers, getModelConfig, updateModelConfig, getAlerts } from '../controllers/bff_admin.controller';

const router = Router();

router.get('/dashboard', getDashboard);
router.get('/feedback', getFeedback);
router.get('/users', getUsers);
router.get('/model/config', getModelConfig);
router.put('/model/config', updateModelConfig);
router.get('/alerts', getAlerts);

export default router;
