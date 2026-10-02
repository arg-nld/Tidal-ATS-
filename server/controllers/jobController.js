import { store } from '../services/store.js';

export function getJobs(req, res) {
  const isHr = req.user && req.user.role === 'hr';
  let jobs = store.getJobs();

  // If not HR, only show open job postings
  if (!isHr && req.query.status !== 'all') {
    jobs = jobs.filter(j => j.status === 'open');
  }

  // Include application counts for HR
  if (isHr) {
    const apps = store.getApplications();
    jobs = jobs.map(j => ({
      ...j,
      applicantCount: apps.filter(a => a.jobId === j.id).length
    }));
  }

  return res.json({ jobs });
}

export function getJobById(req, res) {
  const { id } = req.params;
  const job = store.getJobById(id);

  if (!job) {
    return res.status(404).json({ error: 'Job opening not found' });
  }

  // If applicant and job is closed, disallow unless applicant already applied
  if (req.user?.role === 'applicant' && job.status === 'closed') {
    const existing = store.getApplicationsByUserId(req.user.id).find(a => a.jobId === id);
    if (!existing) {
      return res.status(403).json({ error: 'This job posting is closed' });
    }
  }

  return res.json({ job });
}

export function createJob(req, res) {
  const { title, department, location, type, experienceLevel, salaryRange, status, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'Job title and description are required' });
  }

  const job = store.createJob({
    title,
    department: department || 'General',
    location: location || 'Remote',
    type: type || 'Full-time',
    experienceLevel: experienceLevel || 'Mid-Senior',
    salaryRange: salaryRange || 'Competitive',
    status: status || 'open',
    description
  });

  return res.status(201).json({ job, message: 'Job posting published successfully' });
}

export function updateJob(req, res) {
  const { id } = req.params;
  const updates = req.body;

  const updated = store.updateJob(id, updates);
  if (!updated) {
    return res.status(404).json({ error: 'Job not found' });
  }

  return res.json({ job: updated, message: 'Job updated successfully' });
}

export function deleteJob(req, res) {
  const { id } = req.params;
  const success = store.deleteJob(id);

  if (!success) {
    return res.status(404).json({ error: 'Job not found' });
  }

  return res.json({ message: 'Job deleted successfully' });
}
