import { ensureApplicationTimeline } from './atsHelper.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const FUNNEL_STAGES = [
  { key: 'Application Submitted', label: 'Applied' },
  { key: 'Initial Screening', label: 'Screened' },
  { key: 'Shortlisted', label: 'Shortlisted' },
  { key: 'Interview Scheduled', label: 'Interviewed' },
  { key: 'Job Offer', label: 'Offered' },
  { key: 'Hired', label: 'Hired' }
];
const ACTIVE_STAGES = ['Application Submitted', 'Initial Screening', 'Shortlisted', 'Interview Scheduled', 'Job Offer'];
const MEASURED_STAGE_NAMES = ACTIVE_STAGES;

function parseTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateBoundary(value, isEnd = false) {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const dayStart = Date.parse(`${raw}T00:00:00.000Z`);
    return Number.isFinite(dayStart) ? dayStart + (isEnd ? DAY_MS - 1 : 0) : null;
  }
  return parseTimestamp(raw);
}

function roundDays(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Number(((end - start) / DAY_MS).toFixed(1));
}

function stageFromEvent(event) {
  if (event?.type === 'application_submitted') return 'Application Submitted';
  if (event?.type === 'offer_accepted') return 'Hired';

  const stage = event?.metadata?.toStage || event?.metadata?.newStage || event?.metadata?.stage;
  if (stage) return stage;
  if (event?.type === 'interview_scheduled') return 'Interview Scheduled';
  if (typeof event?.type === 'string' && event.type.startsWith('offer_')) return 'Job Offer';
  return null;
}

function hasAcceptedOffer(application) {
  const offer = application?.offer || {};
  const events = Array.isArray(application?.recordedTimeline)
    ? application.recordedTimeline
    : (Array.isArray(application?.timeline) ? application.timeline : []);
  return String(offer.status || '').toLowerCase() === 'accepted' ||
    (Array.isArray(offer.history) && offer.history.some(item => String(item.action || '').toLowerCase() === 'accepted')) ||
    events.some(event => event?.type === 'offer_accepted');
}

function getHireTimestamp(application) {
  const offer = application?.offer || {};
  const acceptedOffer = hasAcceptedOffer(application);

  if (acceptedOffer) {
    const acceptedTimes = [offer.acceptedAt, offer.respondedAt, offer.candidateRespondedAt]
      .map(parseTimestamp).filter(value => value !== null);
    if (Array.isArray(offer.history)) {
      offer.history
        .filter(item => String(item.action || '').toLowerCase() === 'accepted')
        .map(item => parseTimestamp(item.timestamp))
        .filter(value => value !== null)
        .forEach(value => acceptedTimes.push(value));
    }
    if (acceptedTimes.length) return Math.min(...acceptedTimes);
  }

  const events = Array.isArray(application?.recordedTimeline)
    ? application.recordedTimeline
    : (Array.isArray(application?.timeline) ? application.timeline : []);
  const hireEvents = events
    .filter(event => event?.type === 'offer_accepted' || (
      event?.type === 'stage_changed' && ['Hired'].includes(event?.metadata?.toStage || event?.metadata?.newStage || event?.metadata?.stage)
    ))
    .map(event => parseTimestamp(event.timestamp))
    .filter(value => value !== null);
  return hireEvents.length ? Math.min(...hireEvents) : null;
}

function getTimeToHireDays(application) {
  const appliedAt = parseTimestamp(application?.createdAt);
  const hiredAt = getHireTimestamp(application);
  if (appliedAt === null || hiredAt === null) return null;
  return roundDays(appliedAt, hiredAt);
}

export function calculateAnalytics({
  applications = [],
  jobs = [],
  filters = {}
}) {
  const {
    jobId,
    source,
    status,
    recruiter,
    startDate,
    endDate
  } = filters;

  const parsedStart = parseDateBoundary(startDate, false);
  const parsedEnd = parseDateBoundary(endDate, true);
  const startMs = parsedStart === null ? 0 : parsedStart;
  const endMs = parsedEnd === null ? Infinity : parsedEnd;

  // Merged-away duplicate records are retained for audit/history in the ATS,
  // but must not be counted as separate applications in recruitment metrics.
  const activeApplications = applications.filter(app =>
    !app.mergedInto && String(app.stage || '').toLowerCase() !== 'archived (duplicate merged)'
  );

  // Filter applications by date range, job, source, status, recruiter
  const filteredApps = activeApplications.filter(app => {
    const created = parseTimestamp(app.createdAt) ?? 0;
    if (created < startMs || created > endMs) return false;
    if (jobId && jobId !== 'all' && app.jobId !== jobId) return false;
    if (source && source !== 'all' && (app.source || 'Direct Application') !== source) return false;
    if (status && status !== 'all' && app.stage !== status) return false;
    if (recruiter && recruiter !== 'all') {
      const isAssigned = (app.interview?.interviewer && app.interview.interviewer.toLowerCase().includes(recruiter.toLowerCase())) ||
        (app.evaluation?.evaluatedBy && app.evaluation.evaluatedBy.toLowerCase().includes(recruiter.toLowerCase())) ||
        (app.timeline && app.timeline.some(t => t.performedBy?.toLowerCase().includes(recruiter.toLowerCase())));
      if (!isAssigned) return false;
    }
    return true;
  });

  const jobsMap = new Map(jobs.map(j => [j.id, j]));

  // Ensure timelines on all filtered applications
  const appsWithTimeline = filteredApps.map(app => ({
    ...app,
    // Preserve the original event history separately; the helper may synthesize
    // events for legacy UI features, but synthetic events must not drive metrics.
    recordedTimeline: Array.isArray(app.timeline) ? app.timeline : [],
    timeline: ensureApplicationTimeline(app),
    job: jobsMap.get(app.jobId) || null
  }));

  // ==========================================
  // 1. RECRUITMENT FUNNEL
  // ==========================================
  const stageOrder = {
    'Application Submitted': 1,
    'Initial Screening': 2,
    'Shortlisted': 3,
    'Interview Scheduled': 4,
    'Job Offer': 5,
    'Hired': 6,
    'Rejected': 0
  };

  // Check which candidates ever reached or passed each stage
  function hasReachedStage(app, targetStage) {
    if (app.stage === targetStage) return true;
    const currentOrder = stageOrder[app.stage] || 0;
    const targetOrder = stageOrder[targetStage] || 0;
    if (currentOrder >= targetOrder && currentOrder > 0) return true;

    // Check timeline events
    if (Array.isArray(app.timeline)) {
      if (targetStage === 'Application Submitted') return true;
      if (targetStage === 'Initial Screening' && (app.geminiScore != null || app.timeline.some(t => t.type === 'screening_completed' || stageFromEvent(t) === 'Initial Screening'))) return true;
      if (targetStage === 'Shortlisted' && app.timeline.some(t => stageFromEvent(t) === 'Shortlisted')) return true;
      if (targetStage === 'Interview Scheduled' && (app.interview?.scheduledAt || app.timeline.some(t => stageFromEvent(t) === 'Interview Scheduled'))) return true;
      if (targetStage === 'Job Offer' && (
        ['sent', 'accepted', 'declined', 'expired', 'withdrawn'].includes(String(app.offer?.status || '').toLowerCase()) ||
        app.timeline.some(t => ['offer_sent', 'offer_accepted', 'offer_declined', 'offer_expired', 'offer_withdrawn'].includes(t.type) || stageFromEvent(t) === 'Job Offer')
      )) return true;
      if (targetStage === 'Hired' && (app.stage === 'Hired' || getHireTimestamp(app) !== null)) return true;
    }
    return false;
  }

  const funnelSteps = FUNNEL_STAGES.map((step, idx) => {
    const matchingApps = appsWithTimeline.filter(a => hasReachedStage(a, step.key));
    return {
      stage: step.key,
      label: step.label,
      count: matchingApps.length,
      candidateIds: matchingApps.map(a => a.id),
      stepIndex: idx
    };
  });

  const totalApplied = funnelSteps[0]?.count || 0;

  // Calculate conversion rates & drop-offs
  const funnel = funnelSteps.map((step, idx) => {
    const prevCount = idx === 0 ? step.count : funnelSteps[idx - 1].count;
    const conversionFromPrev = prevCount > 0 ? Number(((step.count / prevCount) * 100).toFixed(1)) : 0;
    const overallConversion = totalApplied > 0 ? Number(((step.count / totalApplied) * 100).toFixed(1)) : 0;
    const dropOffCount = idx > 0 ? Math.max(0, prevCount - step.count) : 0;
    const dropOffRate = prevCount > 0 ? Number(((dropOffCount / prevCount) * 100).toFixed(1)) : 0;

    return {
      ...step,
      conversionFromPrev,
      overallConversion,
      dropOffCount,
      dropOffRate
    };
  });

  // Rejection reasons breakdown
  const rejectedApps = appsWithTimeline.filter(a => a.stage === 'Rejected');
  const rejectionReasonsMap = {};
  rejectedApps.forEach(app => {
    let reason = String(app.rejectionReason || app.rejectionNotes || app.disqualificationReason || '').trim();
    if (!reason && app.recruiterNotes) {
      const lower = app.recruiterNotes.toLowerCase();
      if (lower.includes('salary') || lower.includes('compensation')) reason = 'Compensation Mismatch';
      else if (lower.includes('experience') || lower.includes('junior') || lower.includes('years')) reason = 'Insufficient Experience';
      else if (lower.includes('skill') || lower.includes('tech')) reason = 'Technical Skills Gap';
      else if (lower.includes('culture') || lower.includes('communication')) reason = 'Culture / Soft Skills';
      else if (lower.includes('withdrew') || lower.includes('declined')) reason = 'Candidate Withdrew';
      else reason = app.recruiterNotes.slice(0, 45);
    } else if (!reason && app.geminiScore != null && app.geminiScore < 60) {
      reason = 'Low Resume Match Score';
    }
    if (!reason) reason = 'Reason Not Recorded';
    rejectionReasonsMap[reason] = (rejectionReasonsMap[reason] || 0) + 1;
  });

  const rejectionReasons = Object.entries(rejectionReasonsMap).map(([reason, count]) => ({
    reason,
    count,
    percentage: rejectedApps.length > 0 ? Number(((count / rejectedApps.length) * 100).toFixed(1)) : 0
  })).sort((a, b) => b.count - a.count);

  // ==========================================
  // 2. RECRUITMENT SPEED
  // ==========================================
  const now = Date.now();

  // Only calculate time-to-hire where the application has a recorded hire/offer
  // acceptance timestamp. UpdatedAt is not a reliable substitute for hiredAt.
  const hiredApps = appsWithTimeline.filter(a => a.stage === 'Hired');
  const timeToHireDaysList = hiredApps
    .map(getTimeToHireDays)
    .filter(value => value !== null)
    .sort((a, b) => a - b);

  const avgTimeToHire = timeToHireDaysList.length > 0
    ? Number((timeToHireDaysList.reduce((acc, d) => acc + d, 0) / timeToHireDaysList.length).toFixed(1))
    : null;

  const medianTimeToHire = timeToHireDaysList.length > 0
    ? (timeToHireDaysList.length % 2 === 0
      ? Number(((timeToHireDaysList[timeToHireDaysList.length / 2 - 1] + timeToHireDaysList[timeToHireDaysList.length / 2]) / 2).toFixed(1))
      : timeToHireDaysList[Math.floor(timeToHireDaysList.length / 2)])
    : null;

  // Time-to-fill is a job-lifecycle measure, not an application-cohort measure.
  // It therefore uses all non-merged hires and honors only the selected job filter.
  // A role is considered filled only when it is closed and at least one hire exists;
  // open roles show age-in-days rather than a misleading completed fill time.
  const allHiredApplications = activeApplications.filter(app => app.stage === 'Hired');
  const jobsForFill = jobId && jobId !== 'all' ? jobs.filter(job => job.id === jobId) : jobs;
  const timeToFillByJob = jobsForFill.map(job => {
    const jobHires = allHiredApplications.filter(app => app.jobId === job.id);
    const created = parseTimestamp(job.createdAt);
    const hireTimes = jobHires
      .map(getHireTimestamp)
      .filter(value => value !== null && (created === null || value >= created));
    const isClosed = String(job.status || '').toLowerCase() === 'closed';
    const isFilled = isClosed && jobHires.length > 0;
    let daysToFill = null;
    let daysOpen = null;

    if (isFilled && created !== null && hireTimes.length > 0) {
      daysToFill = roundDays(created, Math.min(...hireTimes));
    } else if (!isClosed && created !== null) {
      daysOpen = roundDays(created, now);
    }

    return {
      jobId: job.id,
      jobTitle: job.title,
      department: job.department,
      status: job.status,
      hiresCount: jobHires.length,
      daysToFill: isFilled ? daysToFill : null,
      daysOpen,
      isFilled,
      isClosed
    };
  });

  const completedFillTimes = timeToFillByJob
    .filter(job => job.isFilled && job.daysToFill !== null)
    .map(job => job.daysToFill);
  const avgTimeToFill = completedFillTimes.length > 0
    ? Number((completedFillTimes.reduce((sum, days) => sum + days, 0) / completedFillTimes.length).toFixed(1))
    : null;

  // Time spent in each recruitment stage. Only real timeline events and known
  // offer-response timestamps are used; generated legacy timelines do not count
  // as historical evidence for stage velocity.
  const stageDurationTotals = Object.fromEntries(
    MEASURED_STAGE_NAMES.map(stageName => [stageName, []])
  );

  appsWithTimeline.forEach(app => {
    const recordedEvents = Array.isArray(app.recordedTimeline) ? app.recordedTimeline : [];
    const transitions = recordedEvents
      .map(event => ({ stage: stageFromEvent(event), timestamp: parseTimestamp(event.timestamp) }))
      .filter(event => event.stage && event.timestamp !== null && (MEASURED_STAGE_NAMES.includes(event.stage) || event.stage === 'Hired'));

    const hireTimestamp = getHireTimestamp(app);
    if (app.stage === 'Hired' && hireTimestamp !== null && !transitions.some(event => event.stage === 'Hired')) {
      transitions.push({ stage: 'Hired', timestamp: hireTimestamp });
    }

    transitions.sort((a, b) => a.timestamp - b.timestamp);
    // Ignore duplicate consecutive stage events generated by imports/merges.
    const distinctTransitions = transitions.filter((event, index, all) =>
      index === 0 || event.stage !== all[index - 1].stage
    );

    distinctTransitions.forEach((event, index) => {
      if (!stageDurationTotals[event.stage]) return;
      const nextTransition = distinctTransitions[index + 1];
      let endAt = null;
      if (nextTransition) {
        endAt = nextTransition.timestamp;
      } else if (app.stage === event.stage) {
        // The candidate is still in this stage, so use elapsed time up to now.
        endAt = now;
      }
      if (endAt === null || endAt < event.timestamp) return;
      const duration = roundDays(event.timestamp, endAt);
      if (duration !== null) stageDurationTotals[event.stage].push(duration);
    });
  });

  const averageStageDurations = Object.entries(stageDurationTotals).map(([stageName, durations]) => ({
    stage: stageName,
    averageDays: durations.length > 0
      ? Number((durations.reduce((sum, days) => sum + days, 0) / durations.length).toFixed(1))
      : null,
    dataPoints: durations.length
  }));

  // Stalled applications (in progress stages without activity for > 14 days)
  const STALLED_THRESHOLD_MS = 14 * DAY_MS;

  const stalledApplications = appsWithTimeline
    .filter(app => ACTIVE_STAGES.includes(app.stage))
    .filter(app => {
      const lastActive = parseTimestamp(app.updatedAt) ?? parseTimestamp(app.createdAt) ?? 0;
      return (now - lastActive) > STALLED_THRESHOLD_MS;
    })
    .map(app => {
      const lastActive = parseTimestamp(app.updatedAt) ?? parseTimestamp(app.createdAt) ?? 0;
      const daysInactive = Math.round((now - lastActive) / DAY_MS);
      return {
        id: app.id,
        name: app.name,
        email: app.email,
        jobId: app.jobId,
        jobTitle: app.job?.title || app.role || 'Position',
        stage: app.stage,
        daysInactive,
        geminiScore: app.geminiScore
      };
    })
    .sort((a, b) => b.daysInactive - a.daysInactive);

  // Overdue evaluations (interviews scheduled before now with no scorecard or evaluation)
  const overdueEvaluations = appsWithTimeline
    .filter(app => app.stage === 'Interview Scheduled' && app.interview?.scheduledAt)
    .filter(app => {
      const interviewTime = parseTimestamp(app.interview.scheduledAt);
      const hasEvaluation = Boolean(app.evaluation?.rating) || (Array.isArray(app.scorecards) && app.scorecards.length > 0);
      return interviewTime !== null && interviewTime < now && !hasEvaluation;
    })
    .map(app => {
      const interviewTime = parseTimestamp(app.interview.scheduledAt);
      const daysOverdue = Number(((now - interviewTime) / DAY_MS).toFixed(1));
      return {
        id: app.id,
        name: app.name,
        email: app.email,
        jobId: app.jobId,
        jobTitle: app.job?.title || app.role || 'Position',
        interviewer: app.interview.interviewer || 'Assigned Interviewer',
        scheduledAt: app.interview.scheduledAt,
        daysOverdue
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  // ==========================================
  // 3. RECRUITMENT SOURCE EFFECTIVENESS
  // ==========================================
  const sourcesMap = {};

  appsWithTimeline.forEach(app => {
    const src = app.source || 'Direct Application';
    if (!sourcesMap[src]) {
      sourcesMap[src] = {
        source: src,
        applications: 0,
        qualified: 0,
        interviews: 0,
        offers: 0,
        hires: 0,
        timeToHireList: [],
        candidateIds: []
      };
    }

    const item = sourcesMap[src];
    item.applications += 1;
    item.candidateIds.push(app.id);

    // Qualified: geminiScore >= 70 or reached Shortlisted/Interview
    const isQualified = (app.geminiScore != null && app.geminiScore >= 70) ||
      ['Shortlisted', 'Interview Scheduled', 'Job Offer', 'Hired'].includes(app.stage) ||
      hasReachedStage(app, 'Shortlisted');
    if (isQualified) item.qualified += 1;

    if (hasReachedStage(app, 'Interview Scheduled')) item.interviews += 1;
    if (hasReachedStage(app, 'Job Offer')) item.offers += 1;
    if (app.stage === 'Hired') {
      item.hires += 1;
      const timeToHireDays = getTimeToHireDays(app);
      if (timeToHireDays !== null) item.timeToHireList.push(timeToHireDays);
    }
  });

  // Sourcing spend is stored by job, not channel. Allocating those job totals
  // across source channels would create a misleading cost-per-hire figure.

  const sourceEffectiveness = Object.values(sourcesMap).map(src => {
    const qualRate = src.applications > 0 ? Number(((src.qualified / src.applications) * 100).toFixed(1)) : 0;
    const interviewRate = src.applications > 0 ? Number(((src.interviews / src.applications) * 100).toFixed(1)) : 0;
    const offerRate = src.applications > 0 ? Number(((src.offers / src.applications) * 100).toFixed(1)) : 0;
    const hireRate = src.applications > 0 ? Number(((src.hires / src.applications) * 100).toFixed(1)) : 0;
    const avgSourceTimeToHire = src.timeToHireList.length > 0
      ? Number((src.timeToHireList.reduce((a, b) => a + b, 0) / src.timeToHireList.length).toFixed(1))
      : null;

    // No source-level spend is stored yet, so this cannot be calculated honestly.
    const costPerHire = null;

    return {
      source: src.source,
      applications: src.applications,
      qualified: src.qualified,
      qualifiedRate: qualRate,
      interviews: src.interviews,
      interviewRate,
      offers: src.offers,
      offerRate,
      hires: src.hires,
      hireRate,
      avgTimeToHire: avgSourceTimeToHire,
      costPerHire
    };
  }).sort((a, b) => b.applications - a.applications);

  // Overall KPI highlights
  const totalHires = hiredApps.length;
  const acceptedOfferCount = appsWithTimeline.filter(hasAcceptedOffer).length;
  const offerAcceptanceRate = funnelSteps[4]?.count > 0
    ? Number(((acceptedOfferCount / funnelSteps[4].count) * 100).toFixed(1))
    : 0;
  const attentionNeededCount = new Set([
    ...stalledApplications.map(app => app.id),
    ...overdueEvaluations.map(app => app.id)
  ]).size;

  return {
    summary: {
      totalApplications: appsWithTimeline.length,
      totalHires,
      avgTimeToHire,
      medianTimeToHire,
      avgTimeToFill,
      offerAcceptanceRate,
      stalledCount: stalledApplications.length,
      overdueEvaluationsCount: overdueEvaluations.length,
      attentionNeededCount
    },
    funnel,
    rejectionReasons,
    speed: {
      avgTimeToHire,
      medianTimeToHire,
      avgTimeToFill,
      timeToFillByJob,
      averageStageDurations,
      stalledApplications,
      overdueEvaluations
    },
    sources: sourceEffectiveness,
    filtersApplied: {
      jobId: jobId || 'all',
      source: source || 'all',
      status: status || 'all',
      recruiter: recruiter || 'all',
      startDate: startDate || null,
      endDate: endDate || null
    }
  };
}

export function generateAnalyticsCsv(analytics) {
  const lines = [];
  lines.push('TIDAL ATS - RECRUITMENT ANALYTICS & HR REPORT');
  lines.push(`Generated At,${new Date().toISOString()}`);
  lines.push('');

  // 1. Summary
  lines.push('--- EXECUTIVE SUMMARY ---');
  lines.push('Metric,Value');
  lines.push(`Total Applications,${analytics.summary.totalApplications}`);
  lines.push(`Total Hires,${analytics.summary.totalHires}`);
  lines.push(`Avg Time to Hire (Days),${analytics.summary.avgTimeToHire ?? ''}`);
  lines.push(`Median Time to Hire (Days),${analytics.summary.medianTimeToHire ?? ''}`);
  lines.push(`Avg Time to Fill (Days),${analytics.summary.avgTimeToFill ?? ''}`);
  lines.push(`Offer Acceptance Rate (%),${analytics.summary.offerAcceptanceRate}%`);
  lines.push(`Stalled Applications,${analytics.summary.stalledCount}`);
  lines.push(`Overdue Evaluations,${analytics.summary.overdueEvaluationsCount}`);
  lines.push('');

  // 2. Funnel
  lines.push('--- RECRUITMENT FUNNEL ---');
  lines.push('Stage,Candidate Count,Conversion from Previous (%),Overall Conversion (%),Drop-off Count,Drop-off Rate (%)');
  (analytics.funnel || []).forEach(step => {
    lines.push(`"${step.stage}",${step.count},${step.conversionFromPrev}%,${step.overallConversion}%,${step.dropOffCount},${step.dropOffRate}%`);
  });
  lines.push('');

  // 3. Rejection Reasons
  lines.push('--- REJECTION REASONS ---');
  lines.push('Reason,Candidate Count,Percentage (%)');
  (analytics.rejectionReasons || []).forEach(r => {
    lines.push(`"${r.reason}",${r.count},${r.percentage}%`);
  });
  lines.push('');

  // 4. Source Effectiveness
  lines.push('--- SOURCE EFFECTIVENESS ---');
  lines.push('Source Channel,Applications,Qualified Count,Qualified Rate (%),Interviews,Interview Rate (%),Offers,Offer Rate (%),Hires,Hire Rate (%),Avg Time to Hire (Days),Cost Per Hire');
  (analytics.sources || []).forEach(s => {
    lines.push(`"${s.source}",${s.applications},${s.qualified},${s.qualifiedRate}%,${s.interviews},${s.interviewRate}%,${s.offers},${s.offerRate}%,${s.hires},${s.hireRate}%,${s.avgTimeToHire ?? ''},${s.costPerHire != null ? `₱${s.costPerHire}` : 'N/A'}`);
  });
  lines.push('');

  // 5. Time in Stages
  lines.push('--- AVERAGE DURATION PER RECRUITMENT STAGE ---');
  lines.push('Stage,Average Duration (Days)');
  ((analytics.speed && analytics.speed.averageStageDurations) || []).forEach(sd => {
    lines.push(`"${sd.stage}",${sd.averageDays ?? ''}`);
  });

  return lines.join('\n');
}
