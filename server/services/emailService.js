import { store } from './store.js';

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

  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject: String(subject || '').trim(),
    text: String(body || ''),
    html: html || `<div style="font-family:Arial,sans-serif;line-height:1.6">${textToHtml(body || '')}</div>`
  };

  if (!payload.to[0] || !payload.subject) {
    throw new Error('Email recipient and subject are required.');
  }

  if (attachments.length) {
    payload.attachments = attachments.map(file => ({
      filename: file.filename,
      content: file.contentBase64 || file.content
    }));
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();
  let result = null;
  try { result = JSON.parse(responseText); } catch { /* non-JSON response */ }

  if (!response.ok) {
    throw new Error(result?.message || result?.error || `Email provider returned HTTP ${response.status}.`);
  }

  return result || { id: null };
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
