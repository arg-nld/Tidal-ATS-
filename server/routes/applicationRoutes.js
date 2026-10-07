import { Router } from 'express';
import multer from 'multer';
import {
  getApplications,
  getApplicationById,
  getResumeFile,
  getInterviewAvailability,
  createApplication,
  updateStage,
  updateRecruiterNotes,
  scheduleInterview,
  recordEvaluation,
  deleteApplication
} from '../controllers/applicationController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = Router();
const resumeStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'server/data/uploads'),
  filename: (_req, file, cb) => {
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeOriginal}`);
  }
});
const applicationUpload = multer({
  storage: resumeStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    const byExtension = /\.(pdf|docx|txt)$/i.test(file.originalname || '');
    cb(null, allowed.includes(file.mimetype) || byExtension);
  }
});
const interviewUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 5, fileSize: 10 * 1024 * 1024 }
});

router.get('/', requireAuth, getApplications);
router.get('/availability', requireRole('hr'), getInterviewAvailability);
router.get('/:id', requireAuth, getApplicationById);
router.get('/:id/resume', requireAuth, getResumeFile);
router.post('/', applicationUpload.single('resumeFile'), createApplication);
router.patch('/:id/stage', requireRole('hr'), updateStage);
router.patch('/:id/notes', requireRole('hr'), updateRecruiterNotes);
router.post('/:id/interview', requireRole('hr'), interviewUpload.array('emailAttachments', 5), scheduleInterview);
router.post('/:id/evaluation', requireRole('hr'), recordEvaluation);
router.delete('/:id', requireRole('hr'), deleteApplication);

export default router;
