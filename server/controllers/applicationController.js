import { store } from '../services/store.js';
import { sendStatusChangeEmail } from '../services/emailService.js';
import { screenCandidateWithAI } from '../services/geminiService.js';

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

  // Strict role-based scoping: applicants only get their own submissions
  if (!isHr) {
    if (!req.user) {
      return res.status(401).json({ error: 'Please sign in to view applications' });
    }
    const myApps = store.getApplicationsByUserId(req.user.id);
    const jobs = store.getJobs();
    
    // Enrich with job info
    const enriched = myApps.map(app => ({
      ...app,
      job: jobs.find(j => j.id === app.jobId) || null
    }));
    return res.json({ applications: enriched });
  }

  // HR view: access all applications with optional filtering
  let apps = store.getApplications();
  const { jobId, stage } = req.query;

  if (jobId && jobId !== 'all') {
    apps = apps.filter(a => a.jobId === jobId);
  }

  if (stage && stage !== 'all') {
    apps = apps.filter(a => a.stage === stage);
  }

  const jobs = store.getJobs();
  const enriched = apps.map(app => ({
    ...app,
    job: jobs.find(j => j.id === app.jobId) || null
  }));

  return res.json({ applications: enriched, stages: PIPELINE_STAGES });
}

export function getApplicationById(req, res) {
  const { id } = req.params;
  const app = store.getApplicationById(id);

  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  // Strict data scoping check
  const isHr = req.user && req.user.role === 'hr';
  if (!isHr && (!req.user || app.userId !== req.user.id)) {
    return res.status(403).json({ error: 'Access denied to this candidate record' });
  }

  const job = store.getJobById(app.jobId);
  return res.json({ application: { ...app, job } });
}

export async function createApplication(req, res) {
  const {
    jobId,
    name,
    email,
    phone,
    role,
    skills,
    experienceSummary,
    resumeText,
    fileName,
    fileSize
  } = req.body;

  if (!jobId || !name || !email) {
    return res.status(400).json({ error: 'Job ID, candidate name, and email are required.' });
  }

  const job = store.getJobById(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Target job opening was not found.' });
  }

  // Determine user account to associate
  let userId = req.user ? req.user.id : null;
  if (!userId) {
    // Look up or auto-register applicant user account
    let existingUser = store.getUserByEmail(email);
    if (!existingUser) {
      existingUser = store.createUser({
        name,
        email,
        phone: phone || '',
        role: 'applicant',
        title: role || 'Candidate'
      });
    }
    userId = existingUser.id;
  }

  const newApp = store.createApplication({
    jobId,
    userId,
    name,
    email,
    phone: phone || '',
    role: role || job.title,
    skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map(s => s.trim()) : []),
    experienceSummary: experienceSummary || '',
    resumeText: resumeText || '',
    fileName: fileName || '',
    fileSize: fileSize || 0,
    stage: 'Application Submitted'
  });

  // Trigger automated email notification for application submission
  let notification = null;
  try {
    notification = await sendStatusChangeEmail({
      applicant: newApp,
      job,
      newStage: 'Application Submitted'
    });
  } catch (err) {
    console.error('[ApplicationController] Failed to dispatch submission email:', err);
  }

  // Automatically trigger asynchronous initial AI screening if resume text exists
  if (newApp.resumeText && job.description) {
    setImmediate(async () => {
      try {
        const screeningResult = await screenCandidateWithAI(
          newApp.resumeText,
          job.title,
          job.department,
          job.description
        );
        if (screeningResult) {
          store.updateApplication(newApp.id, {
            geminiScore: screeningResult.score,
            geminiRationale: screeningResult.rationale,
            isScreening: false
          });
        }
      } catch (aiErr) {
        console.warn('[ApplicationController] Async initial screening notice:', aiErr.message);
      }
    });
  }

  return res.status(201).json({
    application: newApp,
    notification,
    message: 'Application submitted successfully! Confirmation email has been sent.'
  });
}

export async function updateStage(req, res) {
  const { id } = req.params;
  const { stage, customNote } = req.body;

  if (!stage || !PIPELINE_STAGES.includes(stage)) {
    return res.status(400).json({
      error: `Invalid stage. Must be one of: ${PIPELINE_STAGES.join(', ')}`
    });
  }

  const app = store.getApplicationById(id);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const prevStage = app.stage;
  const updated = store.updateApplication(id, { stage });
  const job = store.getJobById(app.jobId);

  // Automatically dispatch email notification when status changes
  let notification = null;
  if (prevStage !== stage) {
    try {
      notification = await sendStatusChangeEmail({
        applicant: updated,
        job,
        newStage: stage,
        interviewDetails: updated.interview,
        customNote
      });
    } catch (err) {
      console.error('[ApplicationController] Notification dispatch error:', err);
    }
  }

  return res.json({
    application: updated,
    notification,
    message: `Application advanced to "${stage}". Applicant notified via email.`
  });
}

export function updateRecruiterNotes(req, res) {
  const { id } = req.params;
  const { notes } = req.body;

  const app = store.getApplicationById(id);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const updated = store.updateApplication(id, {
    recruiterNotes: notes ?? ''
  });

  return res.json({ application: updated, message: 'Recruiter notes saved successfully' });
}

export async function scheduleInterview(req, res) {
  const { id } = req.params;
  const { scheduledAt, interviewer, type, meetingLink, notes } = req.body;

  if (!scheduledAt || !interviewer) {
    return res.status(400).json({ error: 'Interview date/time and interviewer are required' });
  }

  const app = store.getApplicationById(id);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const interviewData = {
    scheduledAt,
    interviewer,
    type: type || 'Technical Interview',
    meetingLink: meetingLink || 'https://meet.google.com/ats-session',
    notes: notes || '',
    scheduledBy: req.user?.name || 'Recruiting Team',
    createdAt: Date.now()
  };

  const updated = store.updateApplication(id, {
    interview: interviewData,
    stage: 'Interview Scheduled'
  });

  const job = store.getJobById(app.jobId);

  // Send automated interview schedule email to applicant
  let notification = null;
  try {
    notification = await sendStatusChangeEmail({
      applicant: updated,
      job,
      newStage: 'Interview Scheduled',
      interviewDetails: interviewData
    });
  } catch (err) {
    console.error('[ApplicationController] Interview email error:', err);
  }

  return res.json({
    application: updated,
    notification,
    message: 'Interview scheduled and invitation email dispatched to applicant.'
  });
}

export function recordEvaluation(req, res) {
  const { id } = req.params;
  const { rating, recommendation, comments } = req.body;

  const app = store.getApplicationById(id);
  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const evaluationData = {
    rating: Number(rating) || 3,
    recommendation: recommendation || 'Consider',
    comments: comments || '',
    evaluatedBy: req.user?.name || 'Hiring Team',
    evaluatedAt: Date.now()
  };

  const updated = store.updateApplication(id, {
    evaluation: evaluationData
  });

  return res.json({ application: updated, message: 'Evaluation recorded successfully' });
}

export function deleteApplication(req, res) {
  const { id } = req.params;
  const success = store.deleteApplication(id);

  if (!success) {
    return res.status(404).json({ error: 'Application not found' });
  }

  return res.json({ message: 'Application deleted successfully' });
}
