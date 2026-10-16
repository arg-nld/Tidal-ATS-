import { Router } from 'express';
import { getAnalytics, exportAnalyticsCsv, exportAnalyticsAnalystPack } from '../controllers/analyticsController.js';
import { requireAuth, requireHr } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth, requireHr);

router.get('/', getAnalytics);
router.get('/csv', exportAnalyticsCsv);
router.get('/analyst-pack', exportAnalyticsAnalystPack);

export default router;
