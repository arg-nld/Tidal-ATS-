import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { validateUploadedFile } from '../middleware/uploadSecurity.js';
import { store } from '../services/store.js';
import { sendStatusChangeEmail, sendEmail, createHrApplicationNotification } from '../services/emailService.js';
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

const UPLOADS_ROOT = path.resolve('server/data/uploads');

function sanitizeOriginalFileName(name) {
  return String(name || 'resume')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 180) || 'resume';
}

async function persistValidatedResume(file) {
  if (!file) return null;
  const validation = validateUploadedFile(file, { kind: 'resume' });
  if (!validation.ok) {
    const error = new Error(validation.error);
    error.status = 400;
    throw error;
  }

  await fs.promises.mkdir(UPLOADS_ROOT, { recursive: true });
  const extension = path.extname(file.originalname || '').toLowerCase();
  const storedName = `${crypto.randomUUID()}${extension}`;
  const target = path.join(UPLOADS_ROOT, storedName);
  await fs.promises.writeFile(target, file.buffer, { flag: 'wx' });

  return {
    originalName: sanitizeOriginalFileName(file.originalname),
    storedName,
    mimeType: file.mimetype,
    size: file.size,
    uploadedAt: Date.now()
  };
}

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

  const storedName = path.basename(String(app.resumeFile.storedName || ''));
  if (!storedName || storedName !== String(app.resumeFile.storedName)) {
    return res.status(400).json({ error: 'Stored resume reference is invalid.' });
  }

  const filePath = path.resolve(UPLOADS_ROOT, storedName);
  if (!filePath.startsWith(`${UPLOADS_ROOT}${path.sep}`)) {
    return res.status(400).json({ error: 'Stored resume reference is invalid.' });
  }
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Resume file no longer exists on the server.' });

  const mimeType = String(app.resumeFile.mimeType || 'application/octet-stream').toLowerCase();
  const safeName = sanitizeOriginalFileName(app.resumeFile.originalName);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${safeName.replace(/"/g, '_')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
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

  if (req.user?.role !== 'applicant') {
    return res.status(403).json({ error: 'Only applicant accounts can submit applications.' });
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail !== String(req.user.email || '').trim().toLowerCase()) {
    return res.status(403).json({ error: 'Application email must match the signed-in applicant account.' });
  }

  const userId = req.user.id;

  const existingApplication = store.getApplicationsByUserId(userId).find(item => item.jobId === jobId);
  if (existingApplication) {
    return res.status(409).json({
      error: 'You have already submitted an application for this job.',
      applicationId: existingApplication.id
    });
  }

  let resumeFile = null;
  if (req.file) {
    resumeFile = await persistValidatedResume(req.file);
  }

  let newApp;
  try {
    newApp = store.createApplication({
    jobId,
    userId,
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    phone: String(phone || '').trim(),
    role: String(role || job.title).trim(),
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
    experienceSummary: String(experienceSummary || '').trim(),
    resumeText: String(resumeText || '').trim(),
    fileName: String(fileName || req.file?.originalname || '').trim().slice(0, 255),
    fileSize: Number(fileSize || req.file?.size || 0),
    resumeFile,
    stage: 'Application Submitted'
  });
  } catch (err) {
    if (resumeFile?.storedName) {
      const filePath = path.resolve(UPLOADS_ROOT, resumeFile.storedName);
      try { if (filePath.startsWith(`${UPLOADS_ROOT}${path.sep}`) && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (cleanupErr) { console.warn('[ApplicationController] Resume cleanup failed:', cleanupErr.message); }
    }
    throw err;
  }

  let notification = null;
  try {
    notification = await sendStatusChangeEmail({ applicant: newApp, job, newStage: 'Application Submitted' });
  } catch (err) {
    console.error('[ApplicationController] Application email not sent:', err.message);
  }

  // Create an in-app notification for each HR account. These are separate
  // notification records so ownership checks remain strict per HR user.
  try {
    createHrApplicationNotification({ applicant: newApp, job });
  } catch (err) {
    console.error('[ApplicationController] HR notification creation failed:', err.message);
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

  const emailSent = notification?.deliveryStatus === 'sent';
  return res.json({
    application: updated,
    notification,
    emailSent,
    message: emailSent
      ? `Application advanced to "${stage}" and applicant was emailed.`
      : `Application advanced to "${stage}". The status was saved, but the external email was not delivered.`
  });
}

export function updateRecruiterNotes(req, res) {
  const app = store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const updated = store.updateApplication(app.id, { recruiterNotes: String(req.body.notes ?? '').trim() });
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

  const attachments = Array.isArray(req.files) ? req.files.map(file => ({
    filename: sanitizeOriginalFileName(file.originalname),
    contentBase64: file.buffer.toString('base64'),
    size: file.size,
    mimeType: file.mimetype
  })) : [];

  const interviewData = {
    scheduledAt,
    interviewer,
    type: 'Interview',
    meetingLink: meetingLink || '',
    notes: String(notes || '').trim(),
    emailSubject: String(emailSubject || '').trim(),
    emailBody: String(emailBody || '').trim(),
    attachments: attachments.map(file => ({ filename: file.filename, size: file.size, mimeType: file.mimeType })),
    scheduledBy: req.user?.name || 'Recruiting Team',
    createdAt: Date.now()
  };

  const scheduled = store.scheduleInterviewIfAvailable(id, interviewData, conflictWindowMs);
  if (!scheduled.ok) {
    if (scheduled.reason === 'conflict') return res.status(409).json({ error: 'That interview time is already booked. Please choose another available slot.' });
    if (scheduled.reason === 'invalid_time') return res.status(400).json({ error: 'Invalid interview date/time.' });
    return res.status(404).json({ error: 'Application not found' });
  }

  const updated = scheduled.application;
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
  }

  const emailSent = notification?.deliveryStatus === 'sent';
  return res.json({
    application: updated,
    notification,
    emailSent,
    message: emailSent
      ? 'Interview scheduled and the email was sent to the applicant.'
      : 'Interview scheduled successfully, but the applicant email could not be delivered. The failure was recorded for follow-up.'
  });
}

export function recordEvaluation(req, res) {
  const app = store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  const evaluationData = {
    rating: Number(req.body.rating),
    recommendation: String(req.body.recommendation || 'Consider').trim(),
    comments: String(req.body.comments || '').trim(),
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
    const storedName = path.basename(String(app.resumeFile.storedName));
    const filePath = path.resolve(UPLOADS_ROOT, storedName);
    if (storedName === String(app.resumeFile.storedName) && filePath.startsWith(`${UPLOADS_ROOT}${path.sep}`)) {
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (err) { console.warn('[ApplicationController] Failed to delete resume file:', err.message); }
    }
  }

  store.deleteApplication(app.id);
  return res.json({ message: 'Application deleted successfully' });
}
