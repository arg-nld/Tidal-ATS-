import crypto from 'node:crypto';

export const DEFAULT_SCORECARD_CRITERIA = [
  { id: 'crit-tech', name: 'Technical Competency', description: 'Depth of skills, architecture knowledge, and domain expertise', maxScore: 5 },
  { id: 'crit-comm', name: 'Communication & Collaboration', description: 'Clarity of thought, active listening, and cross-functional team skills', maxScore: 5 },
  { id: 'crit-prob', name: 'Problem Solving & Critical Thinking', description: 'Analytical reasoning, practical trade-offs, and adaptability', maxScore: 5 },
  { id: 'crit-cult', name: 'Values & Culture Alignment', description: 'Ownership mindset, curiosity, professionalism, and integrity', maxScore: 5 }
];

export const SOURCING_SOURCES = [
  'LinkedIn',
  'Indeed',
  'Company Careers',
  'Employee Referral',
  'Direct Application',
  'GitHub / Portfolio',
  'Recruiter Sourced',
  'Other'
];

export const OFFER_STATUSES = [
  'draft',
  'approved',
  'sent',
  'accepted',
  'declined',
  'expired',
  'withdrawn'
];

export function createTimelineEvent({
  type,
  title,
  description = '',
  performedBy = 'System',
  performedByRole = 'system',
  metadata = {},
  timestamp = Date.now()
}) {
  return {
    id: `tle-${timestamp}-${crypto.randomBytes(4).toString('hex')}`,
    type,
    title,
    description: String(description || ''),
    performedBy: String(performedBy || 'System'),
    performedByRole: String(performedByRole || 'system'),
    metadata: metadata || {},
    timestamp: Number(timestamp)
  };
}

/**
 * Builds or synthesizes a timeline for applications that don't have one yet,
 * preserving chronological history.
 */
export function ensureApplicationTimeline(application) {
  if (Array.isArray(application.timeline) && application.timeline.length > 0) {
    return application.timeline;
  }

  const events = [];
  const createdAt = Number(application.createdAt) || Date.now();

  events.push(createTimelineEvent({
    type: 'application_submitted',
    title: 'Application Submitted',
    description: `Application submitted for role "${application.role || 'Position'}"`,
    performedBy: application.name || 'Candidate',
    performedByRole: 'applicant',
    timestamp: createdAt
  }));

  if (application.geminiScore != null) {
    events.push(createTimelineEvent({
      type: 'screening_completed',
      title: 'ATS Match Screening',
      description: `Candidate evaluated with ATS score of ${application.geminiScore}/100`,
      performedBy: 'Tidal ATS Intelligence',
      performedByRole: 'system',
      timestamp: createdAt + 5000,
      metadata: { score: application.geminiScore }
    }));
  }

  if (application.interview?.scheduledAt) {
    events.push(createTimelineEvent({
      type: 'interview_scheduled',
      title: 'Interview Scheduled',
      description: `Interview scheduled with ${application.interview.interviewer || 'Hiring Team'} for ${new Date(application.interview.scheduledAt).toLocaleString()}`,
      performedBy: application.interview.scheduledBy || 'Recruiting Team',
      performedByRole: 'hr',
      timestamp: application.interview.createdAt || (createdAt + 60000),
      metadata: { scheduledAt: application.interview.scheduledAt, interviewer: application.interview.interviewer }
    }));
  }

  if (application.evaluation?.rating) {
    events.push(createTimelineEvent({
      type: 'scorecard_submitted',
      title: 'Evaluation Scorecard Recorded',
      description: `Rating: ${application.evaluation.rating}/5 — Recommendation: ${application.evaluation.recommendation || 'Evaluated'}`,
      performedBy: application.evaluation.evaluatedBy || 'Interviewer',
      performedByRole: 'interviewer',
      timestamp: application.evaluation.evaluatedAt || (createdAt + 120000),
      metadata: { rating: application.evaluation.rating, recommendation: application.evaluation.recommendation }
    }));
  }

  if (application.offer) {
    events.push(createTimelineEvent({
      type: `offer_${application.offer.status || 'created'}`,
      title: `Offer ${String(application.offer.status || 'Created').toUpperCase()}`,
      description: `Compensation: ${application.offer.currency || '₱'} ${Number(application.offer.compensation || 0).toLocaleString()} (${application.offer.salaryPeriod || 'monthly'})`,
      performedBy: application.offer.createdBy || 'HR Team',
      performedByRole: 'hr',
      timestamp: application.offer.createdAt || (createdAt + 180000),
      metadata: { offerId: application.offer.id, status: application.offer.status }
    }));
  }

  if (application.stage && application.stage !== 'Application Submitted') {
    events.push(createTimelineEvent({
      type: 'stage_changed',
      title: `Advanced to ${application.stage}`,
      description: `Candidate progressed to stage "${application.stage}"`,
      performedBy: 'Hiring Team',
      performedByRole: 'hr',
      timestamp: Number(application.updatedAt) || (createdAt + 240000),
      metadata: { stage: application.stage }
    }));
  }

  return events.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Normalizes phone numbers to comparable digits.
 */
export function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D+/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Normalizes names for similarity matching.
 */
export function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Calculates similarity score between two candidate records.
 */
export function detectCandidateSimilarity(candA, candB) {
  if (!candA || !candB || candA.id === candB.id) return null;

  const emailA = String(candA.email || '').trim().toLowerCase();
  const emailB = String(candB.email || '').trim().toLowerCase();

  const phoneA = normalizePhone(candA.phone);
  const phoneB = normalizePhone(candB.phone);

  const nameA = normalizeName(candA.name);
  const nameB = normalizeName(candB.name);

  const reasons = [];
  let confidence = 0;

  // 1. Email exact match
  if (emailA && emailB && emailA === emailB) {
    reasons.push('Identical Email Address');
    confidence = Math.max(confidence, 100);
  }

  // 2. Phone match (at least 7 digits)
  if (phoneA.length >= 7 && phoneB.length >= 7 && (phoneA === phoneB || phoneA.endsWith(phoneB) || phoneB.endsWith(phoneA))) {
    reasons.push('Matching Phone Number');
    confidence = Math.max(confidence, 88);
  }

  // 3. Name match
  if (nameA && nameB) {
    if (nameA === nameB) {
      reasons.push('Identical Full Name');
      confidence = Math.max(confidence, 78);
    } else {
      const tokensA = new Set(nameA.split(' ').filter(t => t.length > 1));
      const tokensB = new Set(nameB.split(' ').filter(t => t.length > 1));
      let intersection = 0;
      tokensA.forEach(t => { if (tokensB.has(t)) intersection++; });
      const union = new Set([...tokensA, ...tokensB]).size;
      const jaccard = union > 0 ? intersection / union : 0;
      if (jaccard >= 0.6 && intersection >= 2) {
        reasons.push('High Name Similarity');
        confidence = Math.max(confidence, Math.round(jaccard * 80));
      }
    }
  }

  if (reasons.length === 0 || confidence < 50) return null;

  return {
    candidateId: candB.id,
    candidateName: candB.name,
    candidateEmail: candB.email,
    candidatePhone: candB.phone,
    jobId: candB.jobId,
    role: candB.role,
    stage: candB.stage,
    createdAt: candB.createdAt,
    confidence,
    reasons
  };
}

/**
 * Calculates combined scorecard summary.
 */
export function calculateScorecardSummary(scorecards = []) {
  if (!Array.isArray(scorecards) || scorecards.length === 0) {
    return {
      count: 0,
      averageRating: 0,
      recommendationBreakdown: { 'Strong Hire': 0, 'Hire': 0, 'Hold': 0, 'Do Not Hire': 0 },
      criteriaAverages: {},
      consensus: 'No evaluations yet'
    };
  }

  let totalRating = 0;
  const recommendationBreakdown = { 'Strong Hire': 0, 'Hire': 0, 'Hold': 0, 'Do Not Hire': 0 };
  const criteriaTotals = {};
  const criteriaCounts = {};

  scorecards.forEach(sc => {
    const r = Number(sc.overallRating) || 0;
    totalRating += r;

    const rec = sc.recommendation || 'Hold';
    recommendationBreakdown[rec] = (recommendationBreakdown[rec] || 0) + 1;

    if (Array.isArray(sc.criteriaRatings)) {
      sc.criteriaRatings.forEach(c => {
        if (!c.criterionId) return;
        const key = c.criterionName || c.criterionId;
        const score = Number(c.score) || 0;
        criteriaTotals[key] = (criteriaTotals[key] || 0) + score;
        criteriaCounts[key] = (criteriaCounts[key] || 0) + 1;
      });
    }
  });

  const averageRating = Number((totalRating / scorecards.length).toFixed(2));
  const criteriaAverages = {};
  Object.keys(criteriaTotals).forEach(key => {
    criteriaAverages[key] = Number((criteriaTotals[key] / criteriaCounts[key]).toFixed(2));
  });

  // Determine consensus recommendation
  const hires = (recommendationBreakdown['Strong Hire'] || 0) + (recommendationBreakdown['Hire'] || 0);
  const rejections = recommendationBreakdown['Do Not Hire'] || 0;
  let consensus = 'Under Review';
  if (rejections > scorecards.length / 2) consensus = 'Consensus: Do Not Hire';
  else if (recommendationBreakdown['Strong Hire'] >= scorecards.length / 2) consensus = 'Consensus: Strong Hire';
  else if (hires > rejections) consensus = 'Consensus: Hire';
  else if (scorecards.length > 0) consensus = 'Consensus: Mixed / Need Discussion';

  return {
    count: scorecards.length,
    averageRating,
    recommendationBreakdown,
    criteriaAverages,
    consensus
  };
}
