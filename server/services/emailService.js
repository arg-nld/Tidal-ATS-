import { store } from './store.js';
import { validEmail, cleanString } from '../middleware/inputValidation.js';

const EMAIL_MAX_RETRIES = Math.max(1, Math.min(5, Number(process.env.EMAIL_MAX_RETRIES || 3)));
const EMAIL_RETRY_BASE_MS = Math.max(250, Number(process.env.EMAIL_RETRY_BASE_MS || 750));

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getEmailType(idempotencyKey = '') {
  const key = String(idempotencyKey);
  if (key.startsWith('verify/')) return 'verification';
  if (key.startsWith('application-stage/')) return 'application-stage';
  return 'transactional';
}

function shouldRetryEmail(err) {
  const status = Number(err?.status || 0);
  return !status || status === 408 || status === 409 || status === 429 || status >= 500;
}

function requireEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    throw new Error('Email delivery is not configured. Add RESEND_API_KEY and EMAIL_FROM to the backend .env.');
  }
  return { apiKey, from };
}

function textToHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

export function generateEmailForStatusChange({ applicant, job, newStage, interviewDetails, customNote }) {
  const applicantName = applicant?.name || 'Applicant';
  const jobTitle = job?.title || 'Open Position';
  const companyName = process.env.COMPANY_NAME || 'Tidal Nexus';

  let subject = '';
  let body = '';

  switch (newStage) {
    case 'Application Submitted':
      subject = `Application Received: ${jobTitle} at ${companyName}`;
      body = `Dear ${applicantName},\n\nThank you for your interest in joining ${companyName}. We have received your application for the ${jobTitle} role.\n\nOur talent acquisition team will review your qualifications and experience.\n\nBest regards,\nThe Talent Acquisition Team\n${companyName}`;
      break;
    case 'Initial Screening':
      subject = `Application Update: ${jobTitle} - Screening in Progress`;
      body = `Dear ${applicantName},\n\nYour application for ${jobTitle} is now undergoing initial review and qualification screening.\n\nWe will update you as soon as this phase concludes.\n\nWarm regards,\n${companyName} Recruiting`;
      break;
    case 'Shortlisted':
      subject = `Great News! You've been shortlisted for ${jobTitle}`;
      body = `Dear ${applicantName},\n\nCongratulations! Your profile has been shortlisted for the ${jobTitle} position at ${companyName}.\n\nOur recruiting team will contact you shortly regarding next steps.\n\nSincerely,\n${companyName} Talent Team`;
      break;
    case 'Interview Scheduled':
      subject = `Interview Scheduled: ${jobTitle} with ${companyName}`;
      body = `Dear ${applicantName},\n\nYour interview for ${jobTitle} has been scheduled.\n\nDate & Time: ${interviewDetails?.scheduledAt ? new Date(interviewDetails.scheduledAt).toLocaleString() : 'To be confirmed'}\nInterviewer(s): ${interviewDetails?.interviewer || 'Recruiting Team'}\nMeeting Link: ${interviewDetails?.meetingLink || 'To be confirmed'}\n\n${interviewDetails?.emailBody || interviewDetails?.notes || 'Please be ready a few minutes before the scheduled time.'}\n\nBest regards,\n${companyName} Hiring Team`;
      break;
    case 'Job Offer':
      subject = `Job Offer: ${jobTitle} at ${companyName}`;
      body = `Dear ${applicantName},\n\nWe are pleased to extend a job offer for the position of ${jobTitle} at ${companyName}. Please review the offer documentation provided by the hiring team.\n\nWarm regards,\n${companyName} Talent Team`;
      break;
    case 'Hired':
      subject = `Official Welcome to ${companyName} - You're Hired!`;
      body = `Dear ${applicantName},\n\nWelcome to the team! We are pleased to confirm that your hiring process for ${jobTitle} is complete.\n\nOur People Operations team will contact you with onboarding information.\n\nWelcome aboard!\n${companyName} People & Culture`;
      break;
    case 'Rejected':
      subject = `Update regarding your application for ${jobTitle}`;
      body = `Dear ${applicantName},\n\nThank you for taking the time to apply for the ${jobTitle} position with ${companyName}. We have decided to move forward with another candidate whose background more closely matches our current needs.\n\nWe appreciate your interest and wish you the best in your career.\n\nRespectfully,\nThe Talent Acquisition Team\n${companyName}`;
      break;
    default:
      subject = `Status Update on your application for ${jobTitle}`;
      body = `Dear ${applicantName},\n\nYour application for ${jobTitle} at ${companyName} has been updated to "${newStage}".${customNote ? `\n\nNote from recruiter:\n${customNote}` : ''}\n\nBest regards,\n${companyName} Talent Team`;
  }

  return { subject, body };
}

export async function sendEmail({
  to,
  subject,
  body,
  html,
  attachments = [],
  idempotencyKey
}) {
  const { apiKey, from } = requireEmailConfig();

  const recipients = (Array.isArray(to) ? to : [to]).map(recipient => validEmail(recipient));
  const safeSubject = cleanString(subject, { field: 'Email subject', max: 200, min: 1, allowEmpty: false, singleLine: true });
  const safeBody = cleanString(body, { field: 'Email body', max: 20000, allowEmpty: true });

  const payload = {
    from,
    to: recipients,
    subject: safeSubject,
    text: safeBody,
    html: html || `<div style="font-family:Arial,sans-serif;line-height:1.6">${textToHtml(safeBody)}</div>`
  };

  if (attachments.length) {
    if (attachments.length > 5) throw new Error('A maximum of 5 email attachments is allowed.');
    const totalBytes = attachments.reduce((sum, file) => sum + Number(file.size || 0), 0);
    if (totalBytes > 20 * 1024 * 1024) throw new Error('Combined email attachments cannot exceed 20 MB.');
    payload.attachments = attachments.map(file => ({
      filename: String(file.filename || 'attachment').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180),
      content: file.contentBase64 || file.content
    }));
  }

  const log = store.createEmailLog({
    to: recipients,
    subject: safeSubject,
    type: getEmailType(idempotencyKey),
    idempotencyKey,
    status: 'sending',
    attempts: 0
  });

  let lastError = null;

  for (let attempt = 1; attempt <= EMAIL_MAX_RETRIES; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let response;
      try {
        response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      const responseText = await response.text();
      let result = null;
      try { result = JSON.parse(responseText); } catch { /* non-JSON response */ }

      if (!response.ok) {
        const error = new Error(result?.message || result?.error || `Email provider returned HTTP ${response.status}.`);
        error.status = response.status;
        throw error;
      }

      store.updateEmailLog(log.id, {
        status: 'sent',
        attempts: attempt,
        providerMessageId: result?.id || null,
        error: null
      });
      return result || { id: null };
    } catch (err) {
      lastError = err;
      store.updateEmailLog(log.id, {
        status: attempt < EMAIL_MAX_RETRIES && shouldRetryEmail(err) ? 'retrying' : 'failed',
        attempts: attempt,
        error: err?.message || 'Email delivery failed.'
      });

      if (attempt >= EMAIL_MAX_RETRIES || !shouldRetryEmail(err)) break;
      await sleep(EMAIL_RETRY_BASE_MS * (2 ** (attempt - 1)));
    }
  }

  throw lastError || new Error('Email delivery failed.');
}

export async function sendStatusChangeEmail({ applicant, job, newStage, interviewDetails, customNote, attachments = [] }) {
  if (!applicant?.email) {
    console.warn('[EmailService] Cannot send email: applicant email missing.');
    return null;
  }

  const generated = generateEmailForStatusChange({ applicant, job, newStage, interviewDetails, customNote });
  const subject = interviewDetails?.emailSubject || generated.subject;
  const body = interviewDetails?.emailBody || generated.body;

  let providerResult = null;
  let deliveryStatus = 'failed';
  let deliveryError = null;

  try {
    providerResult = await sendEmail({
      to: applicant.email,
      subject,
      body,
      attachments,
      idempotencyKey: `application-stage/${applicant.id}/${newStage}/${interviewDetails?.createdAt || Date.now()}`
    });
    deliveryStatus = 'sent';
  } catch (err) {
    // Internal ATS notifications should still be created even when the external
    // email provider rejects delivery (for example while Resend is in testing mode).
    // This keeps the candidate portal useful and makes provider failures visible.
    deliveryError = err?.message || 'External email delivery failed.';
    console.error(`[EmailService] External email delivery failed for ${applicant.email}:`, deliveryError);
  }

  const matchedUser = applicant?.email ? store.getUserByEmail(applicant.email) : null;
  const recipientUserId = matchedUser?.id || applicant.userId || null;

  const notification = store.createNotification({
    applicationId: applicant.id,
    recipientUserId,
    jobId: applicant.jobId,
    recipientEmail: applicant.email,
    recipientName: applicant.name,
    stage: newStage,
    subject,
    body,
    deliveryStatus,
    deliveryError,
    providerMessageId: providerResult?.id || null,
    emailType: 'transactional'
  });

  return notification;
}

export function createHrApplicationNotification({ applicant, job, notificationStore = store }) {
  const hrUsers = notificationStore.getUsersByRole('hr');
  const subject = `New application: ${job?.title || applicant?.role || 'Job Application'}`;
  const body = `A new application has been submitted.\n\nCandidate: ${applicant?.name || 'Candidate'}\nEmail: ${applicant?.email || 'Not provided'}\nPosition: ${job?.title || applicant?.role || 'Position'}\n\nOpen the HR portal to review the application and resume.`;

  return hrUsers.map(hr => notificationStore.createNotification({
    applicationId: applicant.id,
    recipientUserId: hr.id,
    jobId: applicant.jobId,
    recipientEmail: hr.email,
    recipientName: hr.name,
    stage: 'Application Submitted',
    subject,
    body,
    deliveryStatus: 'internal',
    emailType: 'hr-internal'
  }));
}

export async function sendVerificationEmail({ user, token }) {
  const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
  const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const body = `Hi ${user.name || 'there'},\n\nThanks for creating a Tidal Nexus account. Please verify your email address by opening this link:\n\n${verifyUrl}\n\nThis verification link is for your account only.\n\nTidal Nexus`;

  return sendEmail({
    to: user.email,
    subject: 'Verify your Tidal Nexus account',
    body,
    idempotencyKey: `verify/${user.id}/${token}`
  });
}
