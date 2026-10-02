import { Router } from 'express';
import { getJobs, getJobById, createJob, updateJob, deleteJob } from '../controllers/jobController.js';
import { requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// Public / Applicant can view jobs
router.get('/', getJobs);
router.get('/:id', getJobById);

// Recruiter / HR only actions
router.post('/', requireRole('hr'), createJob);
router.put('/:id', requireRole('hr'), updateJob);
router.delete('/:id', requireRole('hr'), deleteJob);

export default router;
