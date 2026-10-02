import { Router } from 'express';
import {
  getApplications,
  getApplicationById,
  createApplication,
  updateStage,
  updateRecruiterNotes,
  scheduleInterview,
  recordEvaluation,
  deleteApplication
} from '../controllers/applicationController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Retrieve applications (strictly scoped by role in controller)
router.get('/', getApplications);
router.get('/:id', getApplicationById);

// Submit application (Applicant portal or external)
router.post('/', createApplication);

// Recruiter actions (Strict HR role requirement)
router.patch('/:id/stage', requireRole('hr'), updateStage);
router.patch('/:id/notes', requireRole('hr'), updateRecruiterNotes);
router.post('/:id/interview', requireRole('hr'), scheduleInterview);
router.post('/:id/evaluation', requireRole('hr'), recordEvaluation);
router.delete('/:id', requireRole('hr'), deleteApplication);

export default router;
