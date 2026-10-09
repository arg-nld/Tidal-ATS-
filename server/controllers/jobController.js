import { store } from '../services/store.js';
import { parsePagination, paginateArray } from '../middleware/pagination.js';

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

export async function getJobs(req, res) {
  const isHr = req.user && req.user.role === 'hr';
  let jobs = await store.getJobs();
  if (!isHr && req.query.status !== 'all') jobs = jobs.filter(j => j.status === 'open');

  if (isHr) {
    const apps = await store.getApplications();
    jobs = jobs.map(j => ({ ...j, applicantCount: apps.filter(a => a.jobId === j.id).length }));
  }

  const page = paginateArray(jobs, parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 }));
  return res.json({ jobs: page.items, ...(page.meta ? { pagination: page.meta } : {}) });
}

export async function getJobById(req, res) {
  const { id } = req.params;
  const job = await store.getJobById(id);
  if (!job) return res.status(404).json({ error: 'Job opening not found' });

  if (req.user?.role === 'applicant' && job.status === 'closed') {
    const existing = (await store.getApplicationsByUserId(req.user.id)).find(a => a.jobId === id);
    if (!existing) return res.status(403).json({ error: 'This job posting is closed' });
  }
  return res.json({ job });
}

export async function createJob(req, res) {
  const { title, department, location, type, experienceLevel, salaryRange, status, description, scoringWeights } = req.body;
  if (!title || !description) return res.status(400).json({ error: 'Job title and description are required' });

  const validation = validateWeights(scoringWeights);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const job = await store.createJob({
    title,
    department: department || 'Engineering',
    location: location || 'Remote',
    type: type || 'Full-time',
    experienceLevel: experienceLevel || '',
    salaryRange: salaryRange || '',
    status: status || 'open',
    description,
    scoringWeights: validation.weights,
    requiredSkills: normalizeSkillList(req.body.requiredSkills),
    nonRequiredSkills: normalizeSkillList(req.body.nonRequiredSkills),
    scorecardCriteria: Array.isArray(req.body.scorecardCriteria) ? req.body.scorecardCriteria : undefined,
    ratingScale: req.body.ratingScale ? Number(req.body.ratingScale) : 5,
    sourcingCost: req.body.sourcingCost ? Number(req.body.sourcingCost) : 0
  });

  return res.status(201).json({ job, message: 'Job posting published successfully' });
}

export async function updateJob(req, res) {
  const { id } = req.params;
  const existing = await store.getJobById(id);
  if (!existing) return res.status(404).json({ error: 'Job not found' });

  // Explicit allow-list prevents mass-assignment of internal fields.
  const allowedFields = [
    'title', 'department', 'location', 'type', 'experienceLevel', 'salaryRange',
    'status', 'description', 'requiredSkills', 'nonRequiredSkills', 'scoringWeights',
    'scorecardCriteria', 'ratingScale', 'sourcingCost'
  ];
  const updates = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) updates[field] = req.body[field];
  }

  if (updates.scoringWeights) {
    const validation = validateWeights(updates.scoringWeights);
    if (validation.error) return res.status(400).json({ error: validation.error });
    updates.scoringWeights = validation.weights;
  }
  if ('requiredSkills' in updates) updates.requiredSkills = normalizeSkillList(updates.requiredSkills);
  if ('nonRequiredSkills' in updates) updates.nonRequiredSkills = normalizeSkillList(updates.nonRequiredSkills);

  const updated = await store.updateJob(id, updates);
  return res.json({ job: updated, message: 'Job updated successfully' });
}

export async function deleteJob(req, res) {
  const success = await store.deleteJob(req.params.id);
  if (!success) return res.status(404).json({ error: 'Job not found' });
  return res.json({ message: 'Job deleted successfully' });
}
