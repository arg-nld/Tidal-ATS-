import { Router } from 'express';
import multer from 'multer';
import { screenCandidate, parseResume } from '../controllers/aiController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { aiParseRateLimiter, aiScreenRateLimiter } from '../middleware/rateLimit.js';
import { validateAiBody } from '../middleware/inputValidation.js';
import { validateUploadedFile } from '../middleware/uploadSecurity.js';

const router = Router();
const upload = multer({
  limits: { fileSize: 15 * 1024 * 1024 },
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]);
    if (!allowed.has(String(file.mimetype || '').toLowerCase())) {
      return cb(Object.assign(new Error('Only PDF, DOCX, and TXT resume files are supported.'), { status: 400 }));
    }
    cb(null, true);
  }
});

// Screening is restricted to HR
router.post('/screen/:id', requireRole('hr'), aiScreenRateLimiter, screenCandidate);

// Resume parsing available for application submissions
router.post('/parse-resume', requireAuth, aiParseRateLimiter, upload.single('resumeFile'), (req, res, next) => {
  const result = validateUploadedFile(req.file, { kind: 'resume' });
  if (!result.ok) return res.status(400).json({ error: result.error });
  next();
}, validateAiBody, parseResume);

export default router;
