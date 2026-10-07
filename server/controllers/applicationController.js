import fs from 'fs';
import path from 'path';
import { store } from '../services/store.js';
import { sendStatusChangeEmail, sendEmail } from '../services/emailService.js';
import { calculateCandidateScore, buildDeterministicRationale } from '../services/scoringService.js';

export const PIPELINE_STAGES = [
  'Application Submitted',
  'Initial Screening',
  'Shortlisted',
  'Interview Scheduled',
  'Job Offer',
  'Hired',
  'Rejected'
];

export function getApplications(req, res) {
  const isHr = req.user && req.user.role === 'hr';
  if (!isHr) {
    if (!req.user) return res.status(401).json({ error: 'Please sign in to view applications' });
    const myApps = store.getApplicationsByUserId(req.user.id);
    const jobs = store.getJobs();
    return res.json({ applications: myApps.map(app => ({ ...app, job: jobs.find(j => j.id === app.jobId) || null })) });
  }

  let apps = store.getApplications();
  const { jobId, stage } = req.query;
  if (jobId && jobId !== 'all') apps = apps.filter(a => a.jobId === jobId);
  if (stage && stage !== 'all') apps = apps.filter(a => a.stage === stage);

  const jobs = store.getJobs();
  return res.json({
    applications: apps.map(app => ({ ...app, job: jobs.find(j => j.id === app.jobId) || null })),
    stages: PIPELINE_STAGES
  });
}

export function getApplicationById(req, res) {
  const app = store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const isHr = req.user && req.user.role === 'hr';
  if (!isHr && (!req.user || app.userId !== req.user.id)) return res.status(403).json({ error: 'Access denied to this candidate record' });

  const job = store.getJobById(app.jobId);
  return res.json({ application: { ...app, job } });
}

export function getResumeFile(req, res) {
  const app = store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const isHr = req.user?.role === 'hr';
  if (!isHr && (!req.user || app.userId !== req.user.id)) return res.status(403).json({ error: 'Access denied' });
  if (!app.resumeFile?.storedName) return res.status(404).json({ error: 'Original resume file is not available for this application.' });

  const filePath = path.resolve('server/data/uploads', app.resumeFile.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Resume file no longer exists on the server.' });

  res.setHeader('Content-Type', app.resumeFile.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${String(app.resumeFile.originalName || 'resume').replace(/"/g, '')}"`);
  return res.sendFile(filePath);
}

export function getInterviewAvailability(req, res) {
  const { date, excludeApplicationId } = req.query;
  if (!date) return res.status(400).json({ error: 'date query parameter is required in YYYY-MM-DD format.' });

  const bookings = store.getApplications()
    .filter(app => app.id !== excludeApplicationId)
    .filter(app => app.interview?.scheduledAt)
    .map(app => ({
      applicationId: app.id,
      candidateName: app.name,
      scheduledAt: app.interview.scheduledAt
    }))
    .filter(item => String(item.scheduledAt).slice(0, 10) === String(date));

  return res.json({ date, bookings });
}

export async function createApplication(req, res) {
  const {
    jobId, name, email, phone, role, skills,
    experienceSummary, resumeText, fileName, fileSize
  } = req.body;

  if (!jobId || !name || !email) return res.status(400).json({ error: 'Job ID, candidate name, and email are required.' });

  const job = store.getJobById(jobId);
  if (!job) return res.status(404).json({ error: 'Target job opening was not found.' });

  let userId = req.user ? req.user.id : null;
  if (!userId) {
    let existingUser = store.getUserByEmail(email);
    if (!existingUser) {
      existingUser = store.createUser({
        name,
        firstName: String(name).trim().split(/\s+/)[0],
        lastName: String(name).trim().split(/\s+/).slice(-1)[0],
        email: email.trim().toLowerCase(),
        phone: phone || '',
        role: 'applicant',
        title: role || 'Candidate',
        emailVerified: true
      });
    }
    userId = existingUser.id;
  }

  const resumeFile = req.file ? {
    originalName: req.file.originalname,
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedAt: Date.now()
  } : null;

  const newApp = store.createApplication({
    jobId,
    userId,
    name,
    email: email.trim().toLowerCase(),
    phone: phone || '',
    role: role || job.title,
    skills: Array.isArray(skills)
      ? skills
      : (typeof skills === 'string'
        ? (() => {
            try {
              const parsedSkills = JSON.parse(skills);
              return Array.isArray(parsedSkills) ? parsedSkills : skills.split(',').map(s => s.trim()).filter(Boolean);
            } catch {
              return skills.split(',').map(s => s.trim()).filter(Boolean);
            }
          })()
        : []),
    experienceSummary: experienceSummary || '',
    resumeText: resumeText || '',
    fileName: fileName || req.file?.originalname || '',
    fileSize: Number(fileSize || req.file?.size || 0),
    resumeFile,
    stage: 'Application Submitted'
  });

  let notification = null;
  try {
    notification = await sendStatusChangeEmail({ applicant: newApp, job, newStage: 'Application Submitted' });
  } catch (err) {
    console.error('[ApplicationController] Application email not sent:', err.message);
  }

  if (newApp.resumeText && job) {
    setImmediate(() => {
      try {
        const result = calculateCandidateScore(newApp, job);
        store.updateApplication(newApp.id, {
          geminiScore: result.score,
          geminiRationale: buildDeterministicRationale(result),
          screeningBreakdown: result.breakdown,
          screeningWeights: result.weights,
          screeningMatchedRequiredSkills: result.matchedRequiredSkills,
          screeningMissingRequiredSkills: result.missingRequiredSkills,
          screeningMatchedNonRequiredSkills: result.matchedNonRequiredSkills,
          screeningMissingNonRequiredSkills: result.missingNonRequiredSkills,
          candidateExperienceYears: result.candidateExperienceYears,
          requiredExperienceYears: result.requiredExperienceYears,
          isScreening: false,
          screeningVersion: 2
        });
      } catch (err) {
        console.warn('[ApplicationController] Initial deterministic screening failed:', err.message);
      }
    });
  }

  return res.status(201).json({
    application: newApp,
    notification,
    message: notification
      ? 'Application submitted successfully! Confirmation email was sent.'
      : 'Application submitted successfully. Email delivery is not configured on this server.'
  });
}

export async function updateStage(req, res) {
  const { id } = req.params;
  const { stage, customNote } = req.body;
  if (!stage || !PIPELINE_STAGES.includes(stage)) return res.status(400).json({ error: `Invalid stage. Must be one of: ${PIPELINE_STAGES.join(', ')}` });

  const app = store.getApplicationById(id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const prevStage = app.stage;
  const updated = store.updateApplication(id, { stage });
  const job = store.getJobById(app.jobId);
  let notification = null;

  if (prevStage !== stage) {
    try {
      notification = await sendStatusChangeEmail({ applicant: updated, job, newStage: stage, interviewDetails: updated.interview, customNote });
    } catch (err) {
      console.error('[ApplicationController] Stage email not sent:', err.message);
    }
  }

  return res.json({
    application: updated,
    notification,
    message: notification
      ? `Application advanced to "${stage}" and applicant was emailed.`
      : `Application advanced to "${stage}". Email delivery is not configured.`
  });
}

export function updateRecruiterNotes(req, res) {
  const app = store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const updated = store.updateApplication(app.id, { recruiterNotes: req.body.notes ?? '' });
  return res.json({ application: updated, message: 'Recruiter notes saved successfully' });
}

export async function scheduleInterview(req, res) {
  const { id } = req.params;
  const { scheduledAt, interviewer, meetingLink, notes, emailSubject, emailBody } = req.body;
  if (!scheduledAt || !interviewer) return res.status(400).json({ error: 'Interview date/time and interviewer are required' });

  const app = store.getApplicationById(id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const requestedMs = new Date(scheduledAt).getTime();
  if (Number.isNaN(requestedMs)) return res.status(400).json({ error: 'Invalid interview date/time.' });

  const conflictWindowMs = 30 * 60 * 1000;
  const conflict = store.getApplications().some(existing => {
    if (existing.id === id || !existing.interview?.scheduledAt) return false;
    const existingMs = new Date(existing.interview.scheduledAt).getTime();
    if (Number.isNaN(existingMs)) return false;
    return Math.abs(existingMs - requestedMs) < conflictWindowMs;
  });

  if (conflict) return res.status(409).json({ error: 'That interview time is already booked. Please choose another available slot.' });

  const attachments = Array.isArray(req.files) ? req.files.map(file => ({
    filename: file.originalname,
    contentBase64: file.buffer.toString('base64'),
    size: file.size,
    mimeType: file.mimetype
  })) : [];

  const interviewData = {
    scheduledAt,
    interviewer,
    type: 'Interview',
    meetingLink: meetingLink || '',
    notes: notes || '',
    emailSubject: String(emailSubject || '').trim(),
    emailBody: String(emailBody || '').trim(),
    attachments: attachments.map(file => ({ filename: file.filename, size: file.size, mimeType: file.mimeType })),
    scheduledBy: req.user?.name || 'Recruiting Team',
    createdAt: Date.now()
  };

  const updated = store.updateApplication(id, { interview: interviewData, stage: 'Interview Scheduled' });
  const job = store.getJobById(app.jobId);
  let notification = null;

  try {
    notification = await sendStatusChangeEmail({
      applicant: updated,
      job,
      newStage: 'Interview Scheduled',
      interviewDetails: interviewData,
      attachments
    });
  } catch (err) {
    console.error('[ApplicationController] Interview email not sent:', err.message);
    return res.status(503).json({
      error: `Interview was saved, but the email could not be sent: ${err.message}`,
      application: updated
    });
  }

  return res.json({ application: updated, notification, message: 'Interview scheduled and the email was sent to the applicant.' });
}

export function recordEvaluation(req, res) {
  const app = store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const evaluationData = {
    rating: Number(req.body.rating) || 3,
    recommendation: req.body.recommendation || 'Consider',
    comments: req.body.comments || '',
    evaluatedBy: req.user?.name || 'Hiring Team',
    evaluatedAt: Date.now()
  };
  const updated = store.updateApplication(app.id, { evaluation: evaluationData });
  return res.json({ application: updated, message: 'Evaluation recorded successfully' });
}

export function deleteApplication(req, res) {
  const app = store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  if (app.resumeFile?.storedName) {
    const filePath = path.resolve('server/data/uploads', app.resumeFile.storedName);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (err) { console.warn('[ApplicationController] Failed to delete resume file:', err.message); }
  }

  store.deleteApplication(app.id);
  return res.json({ message: 'Application deleted successfully' });
}
