import { Router } from 'express';
import multer from 'multer';
import { screenCandidate, parseResume } from '../controllers/aiController.js';
import { requireRole } from '../middleware/authMiddleware.js';

const router = Router();
const upload = multer({
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  storage: multer.memoryStorage()
});

// Screening is restricted to HR
router.post('/screen/:id', requireRole('hr'), screenCandidate);

// Resume parsing available for application submissions
router.post('/parse-resume', upload.single('resumeFile'), parseResume);

export default router;
