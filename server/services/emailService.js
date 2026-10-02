import { store } from './store.js';

/**
 * Stage-specific email templates and notification generator
 */
export function generateEmailForStatusChange({ applicant, job, newStage, interviewDetails, customNote }) {
  const applicantName = applicant?.name || 'Applicant';
  const jobTitle = job?.title || 'Open Position';
  const companyName = 'Tidal Nexus';

  let subject = '';
  let body = '';

  switch (newStage) {
    case 'Application Submitted':
      subject = `Application Received: ${jobTitle} at ${companyName}`;
      body = `Dear ${applicantName},

Thank you for your interest in joining ${companyName}! We have received your application for the ${jobTitle} role.

Our talent acquisition team will review your qualifications and experience. You can monitor the real-time status of your application directly inside your Tidal Applicant Portal at any time.

Best regards,
The Talent Acquisition Team
${companyName}`;
      break;

    case 'Initial Screening':
      subject = `Application Update: ${jobTitle} - Screening in Progress`;
      body = `Dear ${applicantName},

We are writing to let you know that your application for ${jobTitle} is now undergoing initial review and qualification screening by our recruiting team.

We assess all candidate profiles carefully against our current team requirements. We will update you as soon as this phase concludes.

Warm regards,
${companyName} Recruiting`;
      break;

    case 'Shortlisted':
      subject = `Great News! You've been shortlisted for ${jobTitle}`;
      body = `Dear ${applicantName},

Congratulations! We are delighted to inform you that your profile has been shortlisted for the ${jobTitle} position at ${companyName}.

Our team was thoroughly impressed by your background and skills. A member of our recruiting team will contact you shortly to coordinate an interview schedule.

Sincerely,
${companyName} Talent Team`;
      break;

    case 'Interview Scheduled': {
      const scheduledTime = interviewDetails?.scheduledAt 
        ? new Date(interviewDetails.scheduledAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
        : 'Date & Time to be confirmed';
      const interviewer = interviewDetails?.interviewer || 'Tidal Interview Panel';
      const interviewType = interviewDetails?.type || 'Video Technical Interview';
      const meetingLink = interviewDetails?.meetingLink || 'https://meet.google.com/ats-session';
      const notes = interviewDetails?.notes ? `\n\nPreparation Notes:\n${interviewDetails.notes}` : '';

      subject = `Interview Scheduled: ${jobTitle} with ${companyName}`;
      body = `Dear ${applicantName},

Your interview for the ${jobTitle} role has been scheduled!

Here are the details for your upcoming discussion:
• Round Type: ${interviewType}
• Date & Time: ${scheduledTime}
• Interviewer(s): ${interviewer}
• Meeting Link: ${meetingLink}${notes}

Please test your microphone and camera ahead of time. If you need to reschedule, please let us know at least 24 hours in advance.

Best of luck,
${companyName} Hiring Team`;
      break;
    }

    case 'Job Offer':
      subject = `Job Offer: ${jobTitle} at ${companyName}!`;
      body = `Dear ${applicantName},

We are thrilled to extend a formal job offer for the position of ${jobTitle} at ${companyName}!

Your exceptional skills, background, and cultural alignment stood out during our interview rounds, and our leadership team believes you will make a tremendous impact here.

Please review your official offer documentation inside your candidate dashboard. Feel free to reply with any questions regarding compensation, benefits, or your anticipated start date.

Warmest congratulations,
Executive Talent Team
${companyName}`;
      break;

    case 'Hired':
      subject = `Official Welcome to ${companyName} - You're Hired!`;
      body = `Dear ${applicantName},

Welcome to the team! We are ecstatic to confirm that your hiring process for ${jobTitle} is complete and official.

Our People Operations team will be reaching out soon with onboarding materials, equipment shipping details, and first-day orientation schedules.

Welcome aboard!
${companyName} People & Culture`;
      break;

    case 'Rejected':
      subject = `Update regarding your application for ${jobTitle}`;
      body = `Dear ${applicantName},

Thank you very much for taking the time to apply and interview for the ${jobTitle} position with ${companyName}.

While your credentials and experience are noteworthy, we have decided to move forward with another candidate whose background more directly aligns with our current specialized priorities.

We sincerely appreciate your interest in ${companyName} and wish you the best in your career endeavors. We will keep your profile in our talent network for future opportunities.

Respectfully,
The Talent Acquisition Team
${companyName}`;
      break;

    default:
      subject = `Status Update on your application for ${jobTitle}`;
      body = `Dear ${applicantName},

Your application for ${jobTitle} at ${companyName} has been updated to "${newStage}".${customNote ? `\n\nNote from recruiter:\n${customNote}` : ''}

Log in to your Applicant Portal to view full details.

Best regards,
${companyName} Talent Team`;
  }

  return { subject, body };
}

/**
 * Send automated email notification and record in store
 */
export async function sendStatusChangeEmail({ applicant, job, newStage, interviewDetails, customNote }) {
  if (!applicant || !applicant.email) {
    console.warn('[EmailService] Cannot send email: applicant or email missing.');
    return null;
  }

  const { subject, body } = generateEmailForStatusChange({
    applicant,
    job,
    newStage,
    interviewDetails,
    customNote
  });

  const notification = store.createNotification({
    applicationId: applicant.id,
    jobId: applicant.jobId,
    recipientEmail: applicant.email,
    recipientName: applicant.name,
    stage: newStage,
    subject,
    body
  });

  // Simulated email dispatch log (can connect to SMTP/SendGrid/Postmark)
  console.log(`\n======================================================`);
  console.log(`✉️  [AUTOMATED EMAIL NOTIFICATION SENT]`);
  console.log(`To: ${applicant.name} <${applicant.email}>`);
  console.log(`Subject: ${subject}`);
  console.log(`Stage: ${newStage}`);
  console.log(`Timestamp: ${new Date(notification.sentAt).toISOString()}`);
  console.log(`------------------------------------------------------`);
  console.log(body);
  console.log(`======================================================\n`);

  return notification;
}
