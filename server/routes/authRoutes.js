import { Router } from 'express';
import { login, register, verifyEmail, getCurrentUser, getUsers } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();
router.post('/login', login);
router.post('/register', register);
router.get('/verify-email/:token', verifyEmail);
router.get('/me', requireAuth, getCurrentUser);
router.get('/users', getUsers);

export default router;
