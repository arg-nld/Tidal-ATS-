import { Router } from 'express';
import { getNotifications, markAsRead, deleteNotification, clearNotifications, retryEmail } from '../controllers/notificationController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', requireAuth, getNotifications);
router.delete('/', requireAuth, clearNotifications);
router.patch('/:id/read', requireAuth, markAsRead);
router.delete('/:id', requireAuth, deleteNotification);
router.post('/:id/retry-email', requireRole('hr'), retryEmail);

export default router;
