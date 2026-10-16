import { Router } from 'express';
import { login, register, verifyEmail, requestPasswordReset, resetPassword, getCurrentUser, logout, deleteCurrentAccount } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { loginRateLimiter, registerRateLimiter, verificationRateLimiter, accountDeletionRateLimiter } from '../middleware/rateLimit.js';
import { validateLoginBody, validateRegistrationBody } from '../middleware/inputValidation.js';

const router = Router();
router.post('/login', loginRateLimiter, validateLoginBody, login);
router.post('/register', registerRateLimiter, validateRegistrationBody, register);
router.get('/verify-email/:token', verificationRateLimiter, verifyEmail);
router.post('/forgot-password', verificationRateLimiter, requestPasswordReset);
router.post('/reset-password', verificationRateLimiter, resetPassword);
router.get('/me', requireAuth, getCurrentUser);
router.post('/logout', requireAuth, logout);
router.delete('/me', requireAuth, accountDeletionRateLimiter, deleteCurrentAccount);

export default router;
