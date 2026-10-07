import { store } from '../services/store.js';

function normalizeSkillList(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean);
}

function validateWeights(scoringWeights) {
  const weights = {
    requiredSkills: Number(scoringWeights?.requiredSkills ?? 70),
    nonRequiredSkills: Number(scoringWeights?.nonRequiredSkills ?? 20),
    experience: Number(scoringWeights?.experience ?? 10)
  };

  if (Object.values(weights).some(v => !Number.isFinite(v) || v < 0 || v > 100)) {
    return { error: 'Each score weight must be a number between 0 and 100.' };
  }
  if (weights.requiredSkills + weights.nonRequiredSkills + weights.experience !== 100) {
    return { error: 'Required skills, non-required skills, and experience weights must total exactly 100%.' };
  }
  return { weights };
}

export function getJobs(req, res) {
  const isHr = req.user && req.user.role === 'hr';
  let jobs = store.getJobs();
  if (!isHr && req.query.status !== 'all') jobs = jobs.filter(j => j.status === 'open');

  if (isHr) {
    const apps = store.getApplications();
    jobs = jobs.map(j => ({ ...j, applicantCount: apps.filter(a => a.jobId === j.id).length }));
  }
  return res.json({ jobs });
}

export function getJobById(req, res) {
  const { id } = req.params;
  const job = store.getJobById(id);
  if (!job) return res.status(404).json({ error: 'Job opening not found' });

  if (req.user?.role === 'applicant' && job.status === 'closed') {
    const existing = store.getApplicationsByUserId(req.user.id).find(a => a.jobId === id);
    if (!existing) return res.status(403).json({ error: 'This job posting is closed' });
  }
  return res.json({ job });
}

export function createJob(req, res) {
  const { title, department, location, type, experienceLevel, salaryRange, status, description, scoringWeights } = req.body;
  if (!title || !description) return res.status(400).json({ error: 'Job title and description are required' });

  const validation = validateWeights(scoringWeights);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const job = store.createJob({
    title,
    department: '',
    location: location || 'Remote',
    type: type || 'Full-time',
    experienceLevel: experienceLevel || '',
    salaryRange: salaryRange || '',
    status: status || 'open',
    description,
    scoringWeights: validation.weights,
    requiredSkills: normalizeSkillList(req.body.requiredSkills),
    nonRequiredSkills: normalizeSkillList(req.body.nonRequiredSkills)
  });

  return res.status(201).json({ job, message: 'Job posting published successfully' });
}

export function updateJob(req, res) {
  const { id } = req.params;
  const existing = store.getJobById(id);
  if (!existing) return res.status(404).json({ error: 'Job not found' });

  const updates = { ...req.body };
  if (updates.scoringWeights) {
    const validation = validateWeights(updates.scoringWeights);
    if (validation.error) return res.status(400).json({ error: validation.error });
    updates.scoringWeights = validation.weights;
  } else {
    updates.scoringWeights = existing.scoringWeights || { requiredSkills: 70, nonRequiredSkills: 20, experience: 10 };
  }
  if ('requiredSkills' in updates) updates.requiredSkills = normalizeSkillList(updates.requiredSkills);
  if ('nonRequiredSkills' in updates) updates.nonRequiredSkills = normalizeSkillList(updates.nonRequiredSkills);

  const updated = store.updateJob(id, updates);
  return res.json({ job: updated, message: 'Job updated successfully' });
}

export function deleteJob(req, res) {
  const success = store.deleteJob(req.params.id);
  if (!success) return res.status(404).json({ error: 'Job not found' });
  return res.json({ message: 'Job deleted successfully' });
}
