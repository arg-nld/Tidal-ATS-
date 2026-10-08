import { Router } from 'express';
import { login, register, verifyEmail, getCurrentUser, logout } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { loginRateLimiter, registerRateLimiter, verificationRateLimiter } from '../middleware/rateLimit.js';
import { validateLoginBody, validateRegistrationBody } from '../middleware/inputValidation.js';

const router = Router();
router.post('/login', loginRateLimiter, validateLoginBody, login);
router.post('/register', registerRateLimiter, validateRegistrationBody, register);
router.get('/verify-email/:token', verificationRateLimiter, verifyEmail);
router.get('/me', requireAuth, getCurrentUser);
router.post('/logout', requireAuth, logout);

export default router;
