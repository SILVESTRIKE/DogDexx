import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { checkAllowedRoles } from '../../middlewares/role.middleware';
import {
    getAllSettings,
    updateSetting,
    getPlans,
    updatePlanLimits,
    getQrScanLogs,
    getRewardLogs,
    getRewardStats
} from '../controllers/admin_settings.controller';

const router = Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(checkAllowedRoles(['admin']));

// App Settings
router.get('/settings', getAllSettings);
router.put('/settings/:key', updateSetting);

// Plan Limits
router.get('/plans', getPlans);
router.put('/plans/:id/limits', updatePlanLimits);

// QR Scan Logs
router.get('/qr-scans', getQrScanLogs);

// Reward Logs
router.get('/rewards', getRewardLogs);
router.get('/rewards/stats', getRewardStats);

export default router;

/**
 * HOW TO USE:
 * 
 * 1. Add this route to your app.ts:
 *    import adminSettingsRoutes from './future_features/routes/admin_settings.route';
 *    app.use('/bff/admin/settings', adminSettingsRoutes);
 * 
 * 2. Seed default settings on app start:
 *    import { AdminSettingsService } from './future_features/services/admin_settings.service';
 *    AdminSettingsService.seedDefaultSettings();
 * 
 * 3. Update dog.controller.ts to log QR scans and use settings:
 *    - Import AdminSettingsService and QrScanLogModel
 *    - Log scan in sendQrScanAlert function
 *    - Get finder reward from settings instead of hardcoded value
 */
