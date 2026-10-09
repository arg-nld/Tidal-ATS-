import { Router } from 'express';
import { getAnalytics, exportAnalyticsCsv } from '../controllers/analyticsController.js';
import { requireAuth, requireHr } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth, requireHr);

router.get('/', getAnalytics);
router.get('/csv', exportAnalyticsCsv);

export default router;
