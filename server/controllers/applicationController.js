import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { validateUploadedFile } from '../middleware/uploadSecurity.js';
import { store } from '../services/store.js';
import { sendStatusChangeEmail, sendEmail, createHrApplicationNotification } from '../services/emailService.js';
import { calculateCandidateScore, buildDeterministicRationale } from '../services/scoringService.js';
import { parsePagination, paginateArray } from '../middleware/pagination.js';
import { putResume, getResume, deleteResume } from '../services/storageService.js';
import {
  createTimelineEvent,
  ensureApplicationTimeline,
  detectCandidateSimilarity,
  calculateScorecardSummary
} from '../services/atsHelper.js';

export const PIPELINE_STAGES = [
  'Application Submitted',
  'Initial Screening',
  'Shortlisted',
  'Interview Scheduled',
  'Job Offer',
  'Hired',
  'Rejected'
];

export function sanitizeOriginalFileName(name) {
  return String(name || 'document').replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/\s+/g, ' ').slice(0, 180) || 'document';
}

async function persistValidatedResume(file) {
  if (!file) return null;
  const validation = validateUploadedFile(file, { kind: 'resume' });
  if (!validation.ok) {
    const error = new Error(validation.error);
    error.status = 400;
    throw error;
  }
  return putResume(file);
}

export async function getApplications(req, res) {
  const isHr = req.user && req.user.role === 'hr';
  const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });

  if (!isHr) {
    if (!req.user) return res.status(401).json({ error: 'Please sign in to view applications' });
    const myApps = await store.getApplicationsByUserId(req.user.id);
    const jobs = await store.getJobs();
    const enriched = myApps.map(app => ({
      ...app,
      timeline: ensureApplicationTimeline(app),
      job: jobs.find(j => j.id === app.jobId) || null
    }));
    const page = paginateArray(enriched, pagination);
    return res.json({ applications: page.items, ...(page.meta ? { pagination: page.meta } : {}) });
  }

  let apps = await store.getApplications();
  const { jobId, stage } = req.query;
  if (jobId && jobId !== 'all') apps = apps.filter(a => a.jobId === jobId);
  if (stage && stage !== 'all') apps = apps.filter(a => a.stage === stage);

  const jobs = await store.getJobs();
  const enriched = apps.map(app => ({
    ...app,
    timeline: ensureApplicationTimeline(app),
    job: jobs.find(j => j.id === app.jobId) || null
  }));
  const page = paginateArray(enriched, pagination);
  return res.json({
    applications: page.items,
    stages: PIPELINE_STAGES,
    ...(page.meta ? { pagination: page.meta } : {})
  });
}

export async function getApplicationById(req, res) {
  const app = await store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const isHr = req.user && req.user.role === 'hr';
  if (!isHr && (!req.user || app.userId !== req.user.id)) return res.status(403).json({ error: 'Access denied to this candidate record' });

  const job = await store.getJobById(app.jobId);
  return res.json({
    application: {
      ...app,
      timeline: ensureApplicationTimeline(app),
      job
    }
  });
}

export async function getResumeFile(req, res) {
  const app = await store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const isHr = req.user?.role === 'hr';
  if (!isHr && (!req.user || app.userId !== req.user.id)) return res.status(403).json({ error: 'Access denied' });
  if (!app.resumeFile?.storedName && !app.resumeFile?.objectKey) {
    return res.status(404).json({ error: 'Original resume file is not available for this application.' });
  }

  const file = await getResume(app.resumeFile);
  if (!file) return res.status(404).json({ error: 'Resume file no longer exists in storage.' });

  res.setHeader('Content-Type', String(file.mimeType || 'application/octet-stream').toLowerCase());
  res.setHeader('Content-Disposition', `inline; filename="${sanitizeOriginalFileName(file.originalName || app.fileName || 'resume').replace(/"/g, '_')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.send(file.buffer);
}

export async function getInterviewAvailability(req, res) {
  const { date, excludeApplicationId } = req.query;
  if (!date) return res.status(400).json({ error: 'date query parameter is required in YYYY-MM-DD format.' });

  const applications = await store.getApplications();
  const bookings = applications
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
    experienceSummary, resumeText, fileName, fileSize,
    source
  } = req.body;

  if (!jobId || !name || !email) return res.status(400).json({ error: 'Job ID, candidate name, and email are required.' });

  const job = await store.getJobById(jobId);
  if (!job) return res.status(404).json({ error: 'Target job opening was not found.' });

  if (req.user?.role !== 'applicant') {
    return res.status(403).json({ error: 'Only applicant accounts can submit applications.' });
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail !== String(req.user.email || '').trim().toLowerCase()) {
    return res.status(403).json({ error: 'Application email must match the signed-in applicant account.' });
  }

  const userId = req.user.id;

  // Prevent duplicate applications to the same job (by user ID or matching email)
  const existingByUser = (await store.getApplicationsByUserId(userId)).find(item => item.jobId === jobId);
  const existingByEmail = (await store.getApplicationsByJobId(jobId)).find(item => item.email.toLowerCase() === normalizedEmail);
  if (existingByUser || existingByEmail) {
    return res.status(409).json({
      error: 'You have already submitted an application for this job opening.',
      applicationId: existingByUser?.id || existingByEmail?.id
    });
  }

  let resumeFile = null;
  if (req.file) {
    resumeFile = await persistValidatedResume(req.file);
  }

  const candidateName = String(name).trim();
  const initialTimeline = [
    createTimelineEvent({
      type: 'application_submitted',
      title: 'Application Submitted',
      description: `Formal application submitted for ${job.title}. Source: ${source || 'Direct Application'}.`,
      performedBy: candidateName,
      performedByRole: 'applicant',
      timestamp: Date.now()
    })
  ];

  let newApp;
  try {
    newApp = await store.createApplication({
      jobId,
      userId,
      name: candidateName,
      email: normalizedEmail,
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
      stage: 'Application Submitted',
      source: String(source || 'Direct Application').trim(),
      timeline: initialTimeline,
      scorecards: []
    });
  } catch (err) {
    try { await deleteResume(resumeFile); } catch (cleanupErr) {
      console.warn('[ApplicationController] Resume cleanup failed:', cleanupErr.message);
    }
    throw err;
  }

  let notification = null;
  try {
    notification = await sendStatusChangeEmail({ applicant: newApp, job, newStage: 'Application Submitted' });
  } catch (err) {
    console.error('[ApplicationController] Application email not sent:', err.message);
  }

  try {
    await createHrApplicationNotification({ applicant: newApp, job });
  } catch (err) {
    console.error('[ApplicationController] HR notification creation failed:', err.message);
  }

  if (newApp.resumeText && job) {
    setImmediate(async () => {
      try {
        const result = calculateCandidateScore(newApp, job);
        const currentApp = await store.getApplicationById(newApp.id);
        const currentTimeline = currentApp?.timeline || [];

        const updatedTimeline = [
          ...currentTimeline,
          createTimelineEvent({
            type: 'screening_completed',
            title: 'ATS Match Screening',
            description: `Automated match evaluation score: ${result.score}/100.`,
            performedBy: 'Tidal ATS Intelligence',
            performedByRole: 'system',
            timestamp: Date.now(),
            metadata: { score: result.score }
          })
        ];

        await store.updateApplication(newApp.id, {
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
          screeningVersion: 2,
          timeline: updatedTimeline
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
      ? (notification.deliveryStatus === 'queued'
        ? 'Application submitted successfully! Confirmation email was queued for delivery.'
        : 'Application submitted successfully! Confirmation email was sent.')
      : 'Application submitted successfully. Email delivery is not configured on this server.'
  });
}

export async function updateStage(req, res) {
  const { id } = req.params;
  const { stage, customNote } = req.body;
  if (!stage || !PIPELINE_STAGES.includes(stage)) return res.status(400).json({ error: `Invalid stage. Must be one of: ${PIPELINE_STAGES.join(', ')}` });

  const app = await store.getApplicationById(id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const prevStage = app.stage;
  const currentTimeline = ensureApplicationTimeline(app);
  const newTimeline = [
    ...currentTimeline,
    createTimelineEvent({
      type: 'stage_changed',
      title: `Pipeline Stage: ${stage}`,
      description: customNote
        ? `Stage transitioned from "${prevStage}" to "${stage}". Note: ${customNote}`
        : `Stage transitioned from "${prevStage}" to "${stage}".`,
      performedBy: req.user?.name || 'Recruiter',
      performedByRole: req.user?.role || 'hr',
      metadata: { fromStage: prevStage, toStage: stage, note: customNote || null }
    })
  ];

  const updated = await store.updateApplication(id, { stage, timeline: newTimeline });
  const job = await store.getJobById(app.jobId);
  let notification = null;

  if (prevStage !== stage) {
    try {
      notification = await sendStatusChangeEmail({ applicant: updated, job, newStage: stage, interviewDetails: updated.interview, customNote });
    } catch (err) {
      console.error('[ApplicationController] Stage email not sent:', err.message);
    }
  }

  const emailSent = ['sent', 'queued'].includes(notification?.deliveryStatus);
  return res.json({
    application: updated,
    notification,
    emailSent,
    message: emailSent
      ? `Application advanced to "${stage}" and applicant was emailed.`
      : `Application advanced to "${stage}". The status was saved, but the external email was not delivered.`
  });
}

export async function updateRecruiterNotes(req, res) {
  const app = await store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const currentTimeline = ensureApplicationTimeline(app);
  const newTimeline = [
    ...currentTimeline,
    createTimelineEvent({
      type: 'notes_updated',
      title: 'Recruiter Notes Updated',
      description: `Internal notes revised by ${req.user?.name || 'Recruiter'}.`,
      performedBy: req.user?.name || 'Recruiting Team',
      performedByRole: 'hr'
    })
  ];

  const updated = await store.updateApplication(app.id, {
    recruiterNotes: String(req.body.notes ?? '').trim(),
    timeline: newTimeline
  });
  return res.json({ application: updated, message: 'Recruiter notes saved successfully' });
}

export async function scheduleInterview(req, res) {
  const { id } = req.params;
  const { scheduledAt, interviewer, meetingLink, notes, emailSubject, emailBody } = req.body;
  if (!scheduledAt || !interviewer) return res.status(400).json({ error: 'Interview date/time and interviewer are required' });

  const app = await store.getApplicationById(id);
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

  const scheduled = await store.scheduleInterviewIfAvailable(id, interviewData, conflictWindowMs);
  if (!scheduled.ok) {
    if (scheduled.reason === 'conflict') return res.status(409).json({ error: 'That interview time is already booked. Please choose another available slot.' });
    if (scheduled.reason === 'invalid_time') return res.status(400).json({ error: 'Invalid interview date/time.' });
    return res.status(404).json({ error: 'Application not found' });
  }

  const currentTimeline = ensureApplicationTimeline(app);
  const newTimeline = [
    ...currentTimeline,
    createTimelineEvent({
      type: 'interview_scheduled',
      title: 'Interview Scheduled',
      description: `Interview booked with ${interviewer} on ${new Date(scheduledAt).toLocaleString()}${meetingLink ? ` (Link: ${meetingLink})` : ''}.`,
      performedBy: req.user?.name || 'Recruiting Team',
      performedByRole: 'hr',
      metadata: { scheduledAt, interviewer, meetingLink }
    })
  ];

  const updated = await store.updateApplication(id, { timeline: newTimeline });
  const job = await store.getJobById(app.jobId);
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

  const emailSent = ['sent', 'queued'].includes(notification?.deliveryStatus);
  return res.json({
    application: updated,
    notification,
    emailSent,
    message: emailSent
      ? (notification?.deliveryStatus === 'queued'
        ? 'Interview scheduled and the applicant email was queued for delivery.'
        : 'Interview scheduled and the email was sent to the applicant.')
      : 'Interview scheduled successfully, but the applicant email could not be delivered. The failure was recorded for follow-up.'
  });
}

export async function recordEvaluation(req, res) {
  const app = await store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const evaluationData = {
    rating: Number(req.body.rating),
    recommendation: String(req.body.recommendation || 'Consider').trim(),
    comments: String(req.body.comments || '').trim(),
    evaluatedBy: req.user?.name || 'Hiring Team',
    evaluatedAt: Date.now()
  };

  const currentTimeline = ensureApplicationTimeline(app);
  const newTimeline = [
    ...currentTimeline,
    createTimelineEvent({
      type: 'scorecard_submitted',
      title: 'Interview Evaluation Recorded',
      description: `Overall Rating: ${evaluationData.rating}/5 — Recommendation: ${evaluationData.recommendation}. Evaluated by ${evaluationData.evaluatedBy}.`,
      performedBy: evaluationData.evaluatedBy,
      performedByRole: 'hr',
      metadata: evaluationData
    })
  ];

  const updated = await store.updateApplication(app.id, {
    evaluation: evaluationData,
    timeline: newTimeline
  });
  return res.json({ application: updated, message: 'Evaluation recorded successfully' });
}

// ==========================================
// A. INTERVIEW SCORECARDS
// ==========================================
export async function recordScorecard(req, res) {
  const app = await store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const { criteriaRatings, overallRating, recommendation, comments, interviewerName } = req.body;

  const interviewer = String(interviewerName || req.user?.name || 'Interviewer').trim();
  const scorecard = {
    id: `sc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    interviewerName: interviewer,
    interviewerEmail: req.user?.email || null,
    submittedAt: Date.now(),
    overallRating: Number(overallRating) || 3,
    recommendation: String(recommendation || 'Hire').trim(),
    comments: String(comments || '').trim(),
    criteriaRatings: Array.isArray(criteriaRatings) ? criteriaRatings : []
  };

  const currentScorecards = Array.isArray(app.scorecards) ? [...app.scorecards] : [];
  currentScorecards.push(scorecard);

  // Compute aggregate evaluation for backwards compatibility
  const summary = calculateScorecardSummary(currentScorecards);
  const evaluation = {
    rating: summary.averageRating,
    recommendation: scorecard.recommendation,
    comments: scorecard.comments || `Consensus: ${summary.consensus}`,
    evaluatedBy: interviewer,
    evaluatedAt: Date.now()
  };

  const currentTimeline = ensureApplicationTimeline(app);
  const newTimeline = [
    ...currentTimeline,
    createTimelineEvent({
      type: 'scorecard_submitted',
      title: `Interview Scorecard: ${scorecard.recommendation}`,
      description: `Scorecard submitted by ${interviewer}. Rating: ${scorecard.overallRating}/5. ${scorecard.comments ? `Notes: "${scorecard.comments}"` : ''}`,
      performedBy: interviewer,
      performedByRole: 'interviewer',
      metadata: {
        scorecardId: scorecard.id,
        rating: scorecard.overallRating,
        recommendation: scorecard.recommendation
      }
    })
  ];

  const updated = await store.updateApplication(app.id, {
    scorecards: currentScorecards,
    evaluation,
    timeline: newTimeline
  });

  return res.status(201).json({
    application: updated,
    scorecard,
    summary,
    message: 'Scorecard recorded successfully.'
  });
}

export async function getScorecards(req, res) {
  const app = await store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const scorecards = Array.isArray(app.scorecards) ? app.scorecards : [];
  const summary = calculateScorecardSummary(scorecards);

  return res.json({
    scorecards,
    summary
  });
}

// ==========================================
// B. CANDIDATE ACTIVITY TIMELINE
// ==========================================
export async function getTimeline(req, res) {
  const app = await store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const isHr = req.user && req.user.role === 'hr';
  if (!isHr && (!req.user || app.userId !== req.user.id)) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const timeline = ensureApplicationTimeline(app);
  return res.json({ timeline });
}

// ==========================================
// C. DUPLICATE CANDIDATE DETECTION & MERGE
// ==========================================
export async function getDuplicates(req, res) {
  const app = await store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const allApps = await store.getApplications();
  const duplicates = [];

  for (const other of allApps) {
    if (other.id === app.id) continue;
    const match = detectCandidateSimilarity(app, other);
    if (match) {
      duplicates.push(match);
    }
  }

  duplicates.sort((a, b) => b.confidence - a.confidence);
  return res.json({ candidateId: app.id, duplicates });
}

export async function getAllDuplicates(req, res) {
  const allApps = await store.getApplications();
  const duplicatePairs = [];
  const seenPairs = new Set();

  for (let i = 0; i < allApps.length; i++) {
    for (let j = i + 1; j < allApps.length; j++) {
      const a = allApps[i];
      const b = allApps[j];
      const pairKey = [a.id, b.id].sort().join(':');
      if (seenPairs.has(pairKey)) continue;

      const match = detectCandidateSimilarity(a, b);
      if (match) {
        seenPairs.add(pairKey);
        duplicatePairs.push({
          candidateA: { id: a.id, name: a.name, email: a.email, role: a.role, stage: a.stage, createdAt: a.createdAt },
          candidateB: { id: b.id, name: b.name, email: b.email, role: b.role, stage: b.stage, createdAt: b.createdAt },
          confidence: match.confidence,
          reasons: match.reasons
        });
      }
    }
  }

  duplicatePairs.sort((a, b) => b.confidence - a.confidence);
  return res.json({ duplicatePairs });
}

export async function mergeCandidates(req, res) {
  const { primaryApplicationId, duplicateApplicationIds } = req.body;
  if (!primaryApplicationId || !Array.isArray(duplicateApplicationIds) || duplicateApplicationIds.length === 0) {
    return res.status(400).json({ error: 'primaryApplicationId and an array of duplicateApplicationIds are required.' });
  }

  const primary = await store.getApplicationById(primaryApplicationId);
  if (!primary) return res.status(404).json({ error: 'Primary application record not found.' });

  const merged = await store.mergeApplications(primaryApplicationId, duplicateApplicationIds, req.user?.name || 'HR Recruiter');
  return res.json({
    application: merged,
    message: `Successfully merged ${duplicateApplicationIds.length} duplicate record(s) into ${primary.name}'s profile.`
  });
}

// ==========================================
// D. OFFER MANAGEMENT
// ==========================================
export async function createOrUpdateOffer(req, res) {
  const app = await store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const {
    compensation,
    currency = '₱',
    salaryPeriod = 'monthly',
    proposedStartDate,
    expiryDate,
    notes = '',
    terms = ''
  } = req.body;

  if (!compensation || !proposedStartDate) {
    return res.status(400).json({ error: 'Compensation and proposed start date are required for an offer.' });
  }

  const existingOffer = app.offer || {};
  const isNew = !existingOffer.id;
  const offerId = existingOffer.id || `off-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  const history = Array.isArray(existingOffer.history) ? [...existingOffer.history] : [];
  history.push({
    action: isNew ? 'created' : 'revised',
    performedBy: req.user?.name || 'HR Team',
    timestamp: Date.now(),
    notes: `Compensation: ${currency} ${Number(compensation).toLocaleString()} (${salaryPeriod})`
  });

  const offer = {
    id: offerId,
    status: existingOffer.status === 'approved' || existingOffer.status === 'sent' ? existingOffer.status : 'draft',
    compensation: Number(compensation),
    currency: String(currency || '₱').trim(),
    salaryPeriod: String(salaryPeriod || 'monthly').trim(),
    proposedStartDate: String(proposedStartDate).trim(),
    expiryDate: expiryDate ? String(expiryDate).trim() : null,
    notes: String(notes || '').trim(),
    terms: String(terms || '').trim(),
    createdBy: existingOffer.createdBy || req.user?.name || 'HR Team',
    createdAt: existingOffer.createdAt || Date.now(),
    approvedBy: existingOffer.approvedBy || null,
    approvedAt: existingOffer.approvedAt || null,
    sentAt: existingOffer.sentAt || null,
    respondedAt: existingOffer.respondedAt || null,
    history
  };

  const currentTimeline = ensureApplicationTimeline(app);
  const newTimeline = [
    ...currentTimeline,
    createTimelineEvent({
      type: isNew ? 'offer_created' : 'offer_revised',
      title: isNew ? 'Offer Draft Generated' : 'Offer Terms Revised',
      description: `Compensation: ${offer.currency} ${offer.compensation.toLocaleString()} (${offer.salaryPeriod}). Target Start Date: ${offer.proposedStartDate}.`,
      performedBy: req.user?.name || 'HR Team',
      performedByRole: 'hr',
      metadata: { offerId: offer.id, compensation: offer.compensation }
    })
  ];

  const updated = await store.updateApplication(app.id, { offer, timeline: newTimeline });
  return res.json({ application: updated, offer, message: isNew ? 'Offer draft created.' : 'Offer updated.' });
}

export async function approveOffer(req, res) {
  const app = await store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (!app.offer) return res.status(400).json({ error: 'No offer exists for this candidate.' });

  const history = Array.isArray(app.offer.history) ? [...app.offer.history] : [];
  history.push({
    action: 'approved',
    performedBy: req.user?.name || 'HR Approver',
    timestamp: Date.now(),
    notes: req.body.notes || 'Offer approved for candidate delivery'
  });

  const offer = {
    ...app.offer,
    status: 'approved',
    approvedBy: req.user?.name || 'Head of Talent',
    approvedAt: Date.now(),
    history
  };

  const currentTimeline = ensureApplicationTimeline(app);
  const newTimeline = [
    ...currentTimeline,
    createTimelineEvent({
      type: 'offer_approved',
      title: 'Offer Approved by HR Leadership',
      description: `Approved by ${offer.approvedBy}. Ready to extend to candidate.`,
      performedBy: offer.approvedBy,
      performedByRole: 'hr',
      metadata: { offerId: offer.id }
    })
  ];

  const updated = await store.updateApplication(app.id, { offer, timeline: newTimeline });
  return res.json({ application: updated, offer, message: 'Offer approved successfully.' });
}

export async function sendOffer(req, res) {
  const app = await store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (!app.offer) return res.status(400).json({ error: 'No offer exists for this candidate.' });

  const history = Array.isArray(app.offer.history) ? [...app.offer.history] : [];
  history.push({
    action: 'sent',
    performedBy: req.user?.name || 'HR Team',
    timestamp: Date.now(),
    notes: req.body.notes || 'Formal offer letter dispatched to candidate'
  });

  const offer = {
    ...app.offer,
    status: 'sent',
    sentAt: Date.now(),
    history
  };

  const currentTimeline = ensureApplicationTimeline(app);
  const newTimeline = [
    ...currentTimeline,
    createTimelineEvent({
      type: 'offer_sent',
      title: 'Job Offer Extended',
      description: `Offer sent to ${app.name} (${app.email}). Compensation: ${offer.currency} ${offer.compensation.toLocaleString()} / ${offer.salaryPeriod}. Proposed Start: ${offer.proposedStartDate}.`,
      performedBy: req.user?.name || 'HR Team',
      performedByRole: 'hr',
      metadata: { offerId: offer.id }
    })
  ];

  // Advance application stage to Job Offer
  const updated = await store.updateApplication(app.id, {
    stage: 'Job Offer',
    offer,
    timeline: newTimeline
  });

  const job = await store.getJobById(app.jobId);
  let notification = null;
  try {
    notification = await sendStatusChangeEmail({
      applicant: updated,
      job,
      newStage: 'Job Offer',
      customNote: `We are excited to extend an official job offer! Proposed Start Date: ${offer.proposedStartDate}. Total Compensation: ${offer.currency} ${offer.compensation.toLocaleString()} (${offer.salaryPeriod}).`
    });
  } catch (err) {
    console.error('[ApplicationController] Offer email delivery failed:', err.message);
  }

  return res.json({
    application: updated,
    offer,
    notification,
    message: 'Offer extended and emailed to candidate.'
  });
}

export async function respondToOffer(req, res) {
  const app = await store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (!app.offer) return res.status(400).json({ error: 'No offer found for this candidate.' });

  const { action, declineReason, comments } = req.body;
  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ error: 'action must be either "accept" or "decline".' });
  }

  const isAccept = action === 'accept';
  const history = Array.isArray(app.offer.history) ? [...app.offer.history] : [];
  history.push({
    action: isAccept ? 'accepted' : 'declined',
    performedBy: req.user?.name || app.name,
    timestamp: Date.now(),
    notes: isAccept ? (comments || 'Candidate accepted offer!') : `Declined. Reason: ${declineReason || 'Not specified'}. ${comments || ''}`
  });

  const offer = {
    ...app.offer,
    status: isAccept ? 'accepted' : 'declined',
    respondedAt: Date.now(),
    declineReason: isAccept ? null : (declineReason || 'Not specified'),
    history
  };

  const currentTimeline = ensureApplicationTimeline(app);
  const newTimeline = [
    ...currentTimeline,
    createTimelineEvent({
      type: isAccept ? 'offer_accepted' : 'offer_declined',
      title: isAccept ? '🎉 Offer Accepted!' : 'Offer Declined',
      description: isAccept
        ? `${app.name} has accepted the job offer! Transitioned to Hired.`
        : `${app.name} declined the offer. Reason: ${declineReason || 'None specified'}.`,
      performedBy: req.user?.name || app.name,
      performedByRole: req.user?.role || 'applicant',
      metadata: { offerId: offer.id, declineReason: offer.declineReason }
    })
  ];

  const targetStage = isAccept ? 'Hired' : app.stage;
  const updated = await store.updateApplication(app.id, {
    stage: targetStage,
    offer,
    timeline: newTimeline
  });

  if (isAccept) {
    const job = await store.getJobById(app.jobId);
    try {
      await sendStatusChangeEmail({ applicant: updated, job, newStage: 'Hired' });
    } catch (err) {
      console.error('[ApplicationController] Hired confirmation email failed:', err.message);
    }
  }

  return res.json({
    application: updated,
    offer,
    message: isAccept ? 'Congratulations! Offer accepted and candidate hired.' : 'Offer declined recorded.'
  });
}

export async function withdrawOffer(req, res) {
  const app = await store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });
  if (!app.offer) return res.status(400).json({ error: 'No offer exists for this candidate.' });

  const history = Array.isArray(app.offer.history) ? [...app.offer.history] : [];
  history.push({
    action: 'withdrawn',
    performedBy: req.user?.name || 'HR Team',
    timestamp: Date.now(),
    notes: req.body.reason || 'Offer withdrawn by employer'
  });

  const offer = {
    ...app.offer,
    status: 'withdrawn',
    withdrawnAt: Date.now(),
    history
  };

  const currentTimeline = ensureApplicationTimeline(app);
  const newTimeline = [
    ...currentTimeline,
    createTimelineEvent({
      type: 'offer_withdrawn',
      title: 'Offer Withdrawn',
      description: `Offer withdrawn by ${req.user?.name || 'HR Team'}. Reason: ${req.body.reason || 'Not specified'}.`,
      performedBy: req.user?.name || 'HR Team',
      performedByRole: 'hr',
      metadata: { offerId: offer.id }
    })
  ];

  const updated = await store.updateApplication(app.id, { offer, timeline: newTimeline });
  return res.json({ application: updated, offer, message: 'Offer withdrawn successfully.' });
}

export async function deleteApplication(req, res) {
  const app = await store.getApplicationById(req.params.id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  try {
    await deleteResume(app.resumeFile);
  } catch (err) {
    console.warn('[ApplicationController] Failed to delete resume object:', err.message);
  }

  await store.deleteApplication(app.id);
  return res.json({ message: 'Application deleted successfully' });
}
