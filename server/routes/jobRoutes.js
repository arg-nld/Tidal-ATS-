import { Router } from 'express';
import { getJobs, getJobById, createJob, updateJob, deleteJob } from '../controllers/jobController.js';
import { requireRole } from '../middleware/authMiddleware.js';
import { validateJobBody } from '../middleware/inputValidation.js';

const router = Router();

// Public / Applicant can view jobs
router.get('/', getJobs);
router.get('/:id', getJobById);

// Recruiter / HR only actions
router.post('/', requireRole('hr'), validateJobBody, createJob);
router.put('/:id', requireRole('hr'), validateJobBody, updateJob);
router.delete('/:id', requireRole('hr'), deleteJob);

export default router;
