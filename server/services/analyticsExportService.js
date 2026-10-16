import { deflateRawSync } from 'node:zlib';
import { calculateAnalytics } from './analyticsService.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const STAGE_NAMES = [
  'Application Submitted', 'Initial Screening', 'Shortlisted',
  'Interview Scheduled', 'Job Offer', 'Hired'
];
const ACTIVE_STAGES = new Set([
  'Application Submitted', 'Initial Screening', 'Shortlisted',
  'Interview Scheduled', 'Job Offer'
]);

function parseTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function iso(value) {
  const parsed = parseTimestamp(value);
  return parsed === null ? '' : new Date(parsed).toISOString();
}

function daysBetween(start, end) {
  const a = parseTimestamp(start);
  const b = parseTimestamp(end);
  if (a === null || b === null || b < a) return '';
  return Number(((b - a) / DAY_MS).toFixed(1));
}

function csvCell(value) {
  if (value === null || value === undefined) return '""';
  let text = String(value);
  // Reduce CSV/formula injection risk for untrusted strings opened in Excel.
  // Preserve negative numeric values as numbers, but neutralize formula-like text.
  if (typeof value === 'string' && /^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers, rows) {
  const body = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  // BOM helps Excel recognize UTF-8 names and symbols without corrupting values.
  return `\uFEFF${body}\r\n`;
}

function activeAndFilteredApplications(applications, filters = {}) {
  const { jobId, source, status, recruiter, startDate, endDate } = filters;
  const parseBoundary = (value, isEnd = false) => {
    if (!value) return null;
    const raw = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const dayStart = Date.parse(`${raw}T00:00:00.000Z`);
      return Number.isFinite(dayStart) ? dayStart + (isEnd ? DAY_MS - 1 : 0) : null;
    }
    return parseTimestamp(raw);
  };
  const start = parseBoundary(startDate, false) ?? 0;
  const end = parseBoundary(endDate, true) ?? Infinity;
  const activeApplications = applications.filter(app =>
    !app.mergedInto && String(app.stage || '').toLowerCase() !== 'archived (duplicate merged)'
  );
  const filteredApplications = activeApplications.filter(app => {
    const created = parseTimestamp(app.createdAt) ?? 0;
    if (created < start || created > end) return false;
    if (jobId && jobId !== 'all' && app.jobId !== jobId) return false;
    if (source && source !== 'all' && (app.source || 'Direct Application') !== source) return false;
    if (status && status !== 'all' && app.stage !== status) return false;
    if (recruiter && recruiter !== 'all') {
      const target = String(recruiter).toLowerCase();
      const assigned = String(app.interview?.interviewer || '').toLowerCase().includes(target) ||
        String(app.evaluation?.evaluatedBy || '').toLowerCase().includes(target) ||
        (Array.isArray(app.timeline) && app.timeline.some(event => String(event.performedBy || '').toLowerCase().includes(target)));
      if (!assigned) return false;
    }
    return true;
  });
  return { activeApplications, filteredApplications };
}

function hasAcceptedOffer(app) {
  const offer = app?.offer || {};
  const events = Array.isArray(app?.timeline) ? app.timeline : [];
  return String(offer.status || '').toLowerCase() === 'accepted' ||
    (Array.isArray(offer.history) && offer.history.some(item => String(item.action || '').toLowerCase() === 'accepted')) ||
    events.some(event => event?.type === 'offer_accepted');
}

function hireTimestamp(app) {
  const offer = app?.offer || {};
  const acceptedTimes = [];
  if (hasAcceptedOffer(app)) {
    [offer.acceptedAt, offer.respondedAt, offer.candidateRespondedAt].map(parseTimestamp)
      .filter(value => value !== null).forEach(value => acceptedTimes.push(value));
    if (Array.isArray(offer.history)) offer.history
      .filter(item => String(item.action || '').toLowerCase() === 'accepted')
      .map(item => parseTimestamp(item.timestamp)).filter(value => value !== null)
      .forEach(value => acceptedTimes.push(value));
    if (acceptedTimes.length) return Math.min(...acceptedTimes);
  }
  const events = Array.isArray(app?.timeline) ? app.timeline : [];
  const timestamps = events.filter(event => event?.type === 'offer_accepted' ||
    (event?.type === 'stage_changed' && ['Hired'].includes(event?.metadata?.toStage || event?.metadata?.newStage || event?.metadata?.stage)))
    .map(event => parseTimestamp(event.timestamp)).filter(value => value !== null);
  return timestamps.length ? Math.min(...timestamps) : null;
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

function reachedStage(app, target, funnelIds) {
  return funnelIds.get(target)?.has(app.id) || false;
}

function rejectionReason(app) {
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
  return reason || 'Reason Not Recorded';
}

function sanitizeText(value, app = null) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  const knownPrivateValues = [app?.name, app?.email, app?.phone].filter(item => typeof item === 'string' && item.trim().length >= 3);
  for (const privateValue of knownPrivateValues) {
    text = text.replace(new RegExp(privateValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '[redacted]');
  }
  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]');
  text = text.replace(/(?:\+?\d[\d().\s-]{7,}\d)/g, '[redacted-phone]');
  return text;
}

function sanitizeEventMetadata(metadata, app) {
  const privateKeyPattern = /(name|email|phone|resume|candidate|contact|note|comment|address|description|message|document|file|text|person)/i;
  const sanitize = value => {
    if (Array.isArray(value)) return value.map(sanitize);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value)
        .filter(([key]) => !privateKeyPattern.test(key))
        .map(([key, nested]) => [key, sanitize(nested)]));
    }
    if (typeof value === 'string') return sanitizeText(value, app);
    return value;
  };
  return sanitize(metadata || {});
}

function average(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(2)) : '';
}

function stageDurationsForApp(app, exportNow = Date.now()) {
  const events = (Array.isArray(app.timeline) ? app.timeline : [])
    .map(event => ({ ...event, analyticsStage: stageFromEvent(event), analyticsTimestamp: parseTimestamp(event.timestamp) }))
    .filter(event => event.analyticsStage && event.analyticsTimestamp !== null &&
      (STAGE_NAMES.slice(0, 5).includes(event.analyticsStage) || event.analyticsStage === 'Hired'))
    .sort((a, b) => a.analyticsTimestamp - b.analyticsTimestamp);
  const hireAt = hireTimestamp(app);
  if (app.stage === 'Hired' && hireAt !== null && !events.some(event => event.analyticsStage === 'Hired')) {
    events.push({ type: 'offer_accepted', timestamp: hireAt, analyticsStage: 'Hired', analyticsTimestamp: hireAt });
  }
  events.sort((a, b) => a.analyticsTimestamp - b.analyticsTimestamp);
  const distinct = events.filter((event, index, all) => index === 0 || event.analyticsStage !== all[index - 1].analyticsStage);
  const now = exportNow;
  return distinct.map((event, index) => {
    if (!ACTIVE_STAGES.has(event.analyticsStage)) return null;
    const next = distinct[index + 1];
    let endAt = next?.analyticsTimestamp ?? null;
    if (endAt === null && app.stage === event.analyticsStage) endAt = now;
    if (endAt === null || endAt < event.analyticsTimestamp) return null;
    return {
      applicationId: app.id,
      jobId: app.jobId || '',
      stage: event.analyticsStage,
      stageEnteredAt: new Date(event.analyticsTimestamp).toISOString(),
      stageExitedAt: new Date(endAt).toISOString(),
      durationDays: daysBetween(event.analyticsTimestamp, endAt),
      durationBasis: next ? 'Next recorded stage transition' : 'Still in stage; measured until export time',
      entryEventType: event.type || '',
      exitEventType: next?.type || '',
      recordedEventOnly: 'Recorded event or stored offer acceptance timestamp'
    };
  }).filter(Boolean);
}

function describeRows(filename, headers, description, definitions = {}) {
  return headers.map(field => [filename, field, definitions[field] || field.replace(/_/g, ' '), description]);
}

export function buildAnalyticsExportFiles({ applications = [], jobs = [], filters = {}, analytics: suppliedAnalytics } = {}) {
  const analytics = suppliedAnalytics || calculateAnalytics({ applications, jobs, filters });
  const exportNow = Date.now();
  const exportTimestamp = new Date(exportNow).toISOString();
  const { activeApplications, filteredApplications } = activeAndFilteredApplications(applications, filters);
  const jobMap = new Map(jobs.map(job => [job.id, job]));
  const filteredAppsById = new Map(filteredApplications.map(app => [app.id, app]));
  const funnelIds = new Map((analytics.funnel || []).map(step => [step.stage, new Set(step.candidateIds || [])]));
  const eligibleJobs = filters.jobId && filters.jobId !== 'all' ? jobs.filter(job => job.id === filters.jobId) : jobs;

  const applicationHeaders = [
    'application_id', 'candidate_user_id', 'job_id', 'job_title', 'department', 'job_status', 'application_created_at_utc',
    'application_updated_at_utc', 'source', 'current_stage', 'is_hired', 'is_rejected', 'is_qualified',
    'reached_initial_screening', 'reached_shortlisted', 'reached_interview', 'reached_job_offer', 'reached_hired',
    'resume_match_score', 'scorecard_count', 'average_scorecard_rating_1_to_5', 'evaluation_rating_1_to_5',
    'evaluation_completed', 'interview_scheduled_at_utc', 'interviewer_assigned', 'offer_status',
    'offer_accepted', 'offer_compensation_amount', 'offer_compensation_currency', 'offer_compensation_period',
    'proposed_start_date', 'hire_timestamp_utc', 'time_to_hire_days', 'rejection_reason', 'last_activity_at_utc',
    'days_since_last_activity', 'recruiter_notes_present'
  ];
  const applicationRows = filteredApplications.map(app => {
    const job = jobMap.get(app.jobId) || {};
    const source = app.source || 'Direct Application';
    const reachedScreen = reachedStage(app, 'Initial Screening', funnelIds);
    const reachedShortlist = reachedStage(app, 'Shortlisted', funnelIds);
    const reachedInterview = reachedStage(app, 'Interview Scheduled', funnelIds);
    const reachedOffer = reachedStage(app, 'Job Offer', funnelIds);
    const reachedHired = reachedStage(app, 'Hired', funnelIds);
    const qualified = (app.geminiScore != null && Number(app.geminiScore) >= 70) ||
      ['Shortlisted', 'Interview Scheduled', 'Job Offer', 'Hired'].includes(app.stage) || reachedShortlist;
    const lastActivity = parseTimestamp(app.updatedAt) ?? parseTimestamp(app.createdAt);
    const age = lastActivity === null ? '' : Math.max(0, Math.round((exportNow - lastActivity) / DAY_MS));
    const hiredAt = hireTimestamp(app);
    return [
      app.id, app.userId || '', app.jobId || '', job.title || app.role || '', job.department || '', job.status || '', iso(app.createdAt), iso(app.updatedAt),
      source, app.stage || '', app.stage === 'Hired', app.stage === 'Rejected', qualified,
      reachedScreen, reachedShortlist, reachedInterview, reachedOffer, reachedHired,
      app.geminiScore ?? '', (app.scorecards || []).length,
      average((app.scorecards || []).map(scorecard => scorecard.overallRating).filter(value => value !== null && value !== undefined && value !== '')),
      app.evaluation?.rating ?? '', Boolean(app.evaluation?.rating) || (app.scorecards || []).length > 0,
      iso(app.interview?.scheduledAt), app.interview?.interviewer || '', app.offer?.status || '', hasAcceptedOffer(app),
      app.offer?.compensation?.amount ?? '', app.offer?.compensation?.currency || '', app.offer?.compensation?.period || '',
      app.offer?.proposedStartDate || '', hiredAt === null ? '' : new Date(hiredAt).toISOString(), app.stage === 'Hired' && hiredAt !== null ? daysBetween(app.createdAt, hiredAt) : '',
      app.stage === 'Rejected' ? sanitizeText(rejectionReason(app), app) : '', lastActivity === null ? '' : new Date(lastActivity).toISOString(), age,
      Boolean(String(app.recruiterNotes || '').trim())
    ];
  });

  // Build the exact row-level operands used by time-to-hire and offer acceptance KPIs.
  const offerAcceptedApps = filteredApplications.filter(hasAcceptedOffer).length;
  const offersStepCount = (analytics.funnel || []).find(step => step.stage === 'Job Offer')?.count || 0;
  const totalHiredRows = filteredApplications.filter(app => app.stage === 'Hired');
  const validTimeToHire = totalHiredRows.map(app => {
    const hireAt = hireTimestamp(app);
    return {
      application_id: app.id,
      applied_at_utc: iso(app.createdAt),
      hired_at_utc: hireAt === null ? '' : new Date(hireAt).toISOString(),
      time_to_hire_days: hireAt === null ? '' : daysBetween(app.createdAt, hireAt)
    };
  }).filter(item => item.time_to_hire_days !== '');

  const summaryHeaders = ['metric', 'value', 'unit', 'numerator', 'denominator', 'formula_or_rule', 'data_source', 'interpretation_or_caveat'];
  const timeToHireTotalDays = validTimeToHire.reduce((sum, item) => sum + Number(item.time_to_hire_days), 0);
  const fillObservations = (analytics.speed?.timeToFillByJob || []).filter(job => job.isFilled && job.daysToFill !== null);
  const fillTotalDays = fillObservations.reduce((sum, job) => sum + Number(job.daysToFill), 0);
  const summaryRows = [
    ['Total Applications', analytics.summary.totalApplications, 'applications', analytics.summary.totalApplications, '', 'Count of applications after duplicate-merge exclusion and active filters', 'application_detail.csv', 'Application-cohort metric. Merged duplicate records are excluded.'],
    ['Total Hires', analytics.summary.totalHires, 'applications', analytics.summary.totalHires, '', 'Count of filtered applications whose current stage is Hired', 'application_detail.csv', 'Historical offer acceptance alone does not change the current-stage count.'],
    ['Average Time to Hire', analytics.summary.avgTimeToHire ?? '', 'days', Number(timeToHireTotalDays.toFixed(1)), validTimeToHire.length, 'Sum of valid per-application time_to_hire_days / number of valid hired applications', 'time_to_hire_observations.csv', 'Blank when no complete hire-time observations exist; does not impute from updatedAt.'],
    ['Median Time to Hire', analytics.summary.medianTimeToHire ?? '', 'days', '', validTimeToHire.length, 'Median of valid time-to-hire observations; for an even sample, mean of the two middle values', 'time_to_hire_observations.csv', 'Median has no additive numerator; blank when no complete hire-time observations exist.'],
    ['Average Time to Fill', analytics.summary.avgTimeToFill ?? '', 'days', Number(fillTotalDays.toFixed(1)), fillObservations.length, 'Sum of valid job-level days_to_fill / number of completed time-to-fill observations', 'job_fill_analysis.csv', 'Job lifecycle metric; intentionally uses the selected job filter only, not application source/status/date/recruiter filters.'],
    ['Offer Acceptance Rate', analytics.summary.offerAcceptanceRate, 'percent', offerAcceptedApps, offersStepCount, 'Accepted-offer applications / applications that reached Job Offer * 100', 'application_detail.csv;offer_history.csv;funnel.csv', 'Zero when the denominator is zero.'],
    ['Stalled Applications', analytics.summary.stalledCount, 'applications', analytics.summary.stalledCount, '', 'Count in active stages with updatedAt (or createdAt fallback) more than 14 days before export time', 'stalled_applications.csv', 'Uses the current system time at export.'],
    ['Overdue Evaluations', analytics.summary.overdueEvaluationsCount, 'applications', analytics.summary.overdueEvaluationsCount, '', 'Interview Scheduled applications with scheduledAt in the past and no evaluation rating or scorecard', 'overdue_evaluations.csv', 'Uses the current system time at export.'],
    ['Attention Needed', analytics.summary.attentionNeededCount, 'unique applications', analytics.summary.attentionNeededCount, '', 'Distinct union of stalled applications and overdue evaluations', 'stalled_applications.csv;overdue_evaluations.csv', 'An application appearing in both lists is counted once.']
  ];

  const funnelHeaders = ['stage_order', 'stage', 'stage_label', 'candidate_count', 'previous_stage_count', 'conversion_from_previous_pct', 'total_applications_denominator', 'overall_conversion_pct', 'dropoff_count', 'dropoff_rate_pct', 'candidate_ids'];
  const funnelRows = (analytics.funnel || []).map((step, index, list) => [
    index + 1, step.stage, step.label, step.count, index === 0 ? step.count : list[index - 1].count,
    step.conversionFromPrev, analytics.summary.totalApplications, step.overallConversion, step.dropOffCount, step.dropOffRate,
    (step.candidateIds || []).join('|')
  ]);

  const funnelMembershipHeaders = ['application_id', 'job_id', 'stage_order', 'stage', 'reached_stage'];
  const funnelMembershipRows = (analytics.funnel || []).flatMap((step, index) => (step.candidateIds || []).map(applicationId => [applicationId, filteredAppsById.get(applicationId)?.jobId || '', index + 1, step.stage, true]));

  const sourceHeaders = ['source', 'applications', 'qualified', 'qualified_rate_pct', 'interviews', 'interview_rate_pct', 'offers', 'offer_rate_pct', 'hires', 'hire_rate_pct', 'avg_time_to_hire_days', 'cost_per_hire', 'cost_per_hire_status'];
  const sourceRows = (analytics.sources || []).map(source => [source.source, source.applications, source.qualified, source.qualifiedRate,
    source.interviews, source.interviewRate, source.offers, source.offerRate, source.hires, source.hireRate,
    source.avgTimeToHire ?? '', source.costPerHire ?? '', source.costPerHire == null ? 'Not calculated: no source-level spend data' : 'Calculated']);

  const rejectionHeaders = ['reason', 'count', 'share_of_rejections_pct', 'rejection_population'];
  const rejectionRows = (analytics.rejectionReasons || []).map(reason => [reason.reason, reason.count, reason.percentage,
    filteredApplications.filter(app => app.stage === 'Rejected').length]);

  const jobFillHeaders = ['job_id', 'job_title', 'department', 'job_status', 'job_created_at_utc', 'hire_count', 'first_valid_hire_at_utc', 'is_closed', 'is_filled', 'days_to_fill', 'days_open', 'included_in_average_time_to_fill', 'metric_cohort_rule'];
  const jobFillRows = (analytics.speed?.timeToFillByJob || []).map(item => {
    const job = jobMap.get(item.jobId) || {};
    const jobHires = activeApplications.filter(app => app.jobId === item.jobId && app.stage === 'Hired');
    const hireTimes = jobHires.map(hireTimestamp).filter(value => value !== null && (parseTimestamp(job.createdAt) === null || value >= parseTimestamp(job.createdAt)));
    const firstHire = hireTimes.length ? Math.min(...hireTimes) : null;
    return [item.jobId, item.jobTitle || '', item.department || '', item.status || '', iso(job.createdAt), item.hiresCount,
      firstHire === null ? '' : new Date(firstHire).toISOString(), item.isClosed, item.isFilled, item.daysToFill ?? '', item.daysOpen ?? '',
      item.isFilled && item.daysToFill !== null, 'All non-merged Hired applications; restricted only by selected jobId filter.'];
  });

  const timeToHireHeaders = ['application_id', 'candidate_user_id', 'job_id', 'source', 'application_created_at_utc', 'hire_timestamp_utc', 'time_to_hire_days', 'calculation_rule'];
  const timeToHireRows = validTimeToHire.map(item => {
    const app = filteredAppsById.get(item.application_id) || {};
    return [item.application_id, app.userId || '', app.jobId || '', app.source || 'Direct Application', item.applied_at_utc, item.hired_at_utc, item.time_to_hire_days, 'hire timestamp minus application createdAt; negative/missing durations excluded'];
  });

  const timelineHeaders = ['application_id', 'job_id', 'event_index', 'event_id', 'event_timestamp_utc', 'event_type', 'derived_stage', 'event_title', 'performed_by_role', 'metadata_json'];
  const timelineRows = [];
  filteredApplications.forEach(app => (Array.isArray(app.timeline) ? app.timeline : []).forEach((event, index) => {
    timelineRows.push([app.id, app.jobId || '', index + 1, event.id || '', iso(event.timestamp), event.type || '',
      stageFromEvent(event) || '', sanitizeText(event.title || '', app), event.performedByRole || '', JSON.stringify(sanitizeEventMetadata(event.metadata, app))]);
  }));
  timelineRows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[4]).localeCompare(String(b[4])));

  const stageObservationHeaders = ['application_id', 'job_id', 'stage', 'stage_entered_at_utc', 'stage_exited_at_utc', 'duration_days', 'duration_basis', 'entry_event_type', 'exit_event_type', 'evidence_type'];
  const stageObservationRows = filteredApplications.flatMap(app => stageDurationsForApp(app, exportNow)).map(item => [item.applicationId, item.jobId,
    item.stage, item.stageEnteredAt, item.stageExitedAt, item.durationDays, item.durationBasis, item.entryEventType,
    item.exitEventType, item.recordedEventOnly]);

  const stageSummaryHeaders = ['stage', 'average_duration_days', 'observation_count', 'observations_file', 'calculation_rule'];
  const stageSummaryRows = (analytics.speed?.averageStageDurations || []).map(item => [item.stage, item.averageDays ?? '', item.dataPoints,
    'stage_duration_observations.csv', 'Mean of valid per-application intervals using recorded stage transitions; ongoing current stages measured to export time.']);

  const stalledHeaders = ['application_id', 'job_id', 'job_title', 'current_stage', 'days_inactive', 'last_activity_at_utc', 'resume_match_score'];
  const stalledRows = (analytics.speed?.stalledApplications || []).map(item => {
    const app = filteredAppsById.get(item.id) || {};
    const lastActivity = parseTimestamp(app.updatedAt) ?? parseTimestamp(app.createdAt);
    return [item.id, item.jobId, item.jobTitle, item.stage, item.daysInactive, lastActivity === null ? '' : new Date(lastActivity).toISOString(), item.geminiScore ?? ''];
  });
  const overdueHeaders = ['application_id', 'job_id', 'job_title', 'interviewer', 'interview_scheduled_at_utc', 'days_overdue', 'evaluation_present'];
  const overdueRows = (analytics.speed?.overdueEvaluations || []).map(item => [item.id, item.jobId, item.jobTitle, item.interviewer,
    iso(item.scheduledAt), item.daysOverdue, false]);

  const scorecardHeaders = ['application_id', 'job_id', 'scorecard_id', 'interviewer_name', 'overall_rating_1_to_5', 'recommendation', 'criteria_json', 'created_at_utc'];
  const scorecardRows = [];
  filteredApplications.forEach(app => (Array.isArray(app.scorecards) ? app.scorecards : []).forEach(card => {
    const criteria = card.criteria || card.ratings || card.evaluationCriteria || {};
    scorecardRows.push([app.id, app.jobId || '', card.id || '', card.interviewerName || '', card.overallRating ?? '',
      sanitizeText(card.recommendation || '', app), JSON.stringify(sanitizeEventMetadata(criteria, app)), iso(card.createdAt || card.submittedAt || card.timestamp)]);
  }));

  const offerHeaders = ['application_id', 'job_id', 'current_offer_status', 'compensation_amount', 'compensation_currency', 'compensation_period', 'proposed_start_date', 'expiry_date', 'offer_event_action', 'offer_event_timestamp_utc'];
  const offerRows = [];
  filteredApplications.forEach(app => {
    if (!app.offer) return;
    const base = [app.id, app.jobId || '', app.offer.status || '', app.offer.compensation?.amount ?? '', app.offer.compensation?.currency || '',
      app.offer.compensation?.period || '', app.offer.proposedStartDate || '', app.offer.expiryDate || ''];
    const history = Array.isArray(app.offer.history) ? app.offer.history : [];
    if (!history.length) offerRows.push([...base, '', '']);
    else history.forEach(event => offerRows.push([...base, event.action || '', iso(event.timestamp)]));
  });

  const dictionaryRows = [];
  const filesForDictionary = [
    ['executive_summary.csv', summaryHeaders, 'Metric definitions, exact operands, and interpretation notes.', {
      metric: 'Dashboard KPI or derived metric name', value: 'Value displayed by dashboard or recomputed from the same filtered application/job population', numerator: 'Numerator used by the metric where applicable', denominator: 'Denominator used by the metric where applicable', formula_or_rule: 'Business logic used to derive the value', data_source: 'File(s) for tracing the underlying records', interpretation_or_caveat: 'Population caveat or known limitation'
    }],
    ['application_detail.csv', applicationHeaders, 'One row per non-merged application after all active dashboard filters.', {
      application_id: 'Stable ATS application record identifier; use for joining to event/offer/scorecard files', candidate_user_id: 'ATS account user ID where the applicant has a registered account; may be blank for guest/legacy applications', resume_match_score: 'ATS/Gemini resume match score as stored; blank means no recorded score', is_qualified: 'Resume score >= 70 OR reached Shortlisted/Interview/Job Offer/Hired', hire_timestamp_utc: 'First valid acceptance/hire timestamp found in offer fields/history or recorded timeline; blank if missing', time_to_hire_days: 'Hired timestamp minus application created timestamp; blank if either timestamp is unavailable or duration is negative', days_since_last_activity: 'Export timestamp minus updatedAt, falling back to createdAt'
    }],
    ['time_to_hire_observations.csv', timeToHireHeaders, 'One row per current Hired application with a valid non-negative application-to-hire duration.', {
      hire_timestamp_utc: 'Timestamp recorded by accepted offer fields/history or Hired/offer_accepted timeline event', time_to_hire_days: 'hire timestamp - application createdAt, converted to days and rounded to one decimal place', calculation_rule: 'Metric excludes missing timestamp pairs and invalid negative durations'
    }],
    ['funnel.csv', funnelHeaders, 'Stage funnel counts and rates returned by analytics calculation.', { candidate_ids: 'Pipe-delimited application IDs counted in that funnel stage; normalized one-row-per-application membership is in funnel_membership.csv', conversion_from_previous_pct: 'stage count / preceding stage count * 100', overall_conversion_pct: 'stage count / total applications * 100', dropoff_rate_pct: 'max(0, preceding stage count - stage count) / preceding stage count * 100' }],
    ['funnel_membership.csv', funnelMembershipHeaders, 'One row per filtered application and stage that the dashboard counts as reached.', { application_id: 'Join key to application_detail.csv', stage_order: 'Configured order of the recruitment funnel', reached_stage: 'True means analytics logic counted the application as having reached this stage' }],
    ['source_effectiveness.csv', sourceHeaders, 'Aggregated acquisition-source outcomes for filtered application cohort.', { qualified_rate_pct: 'qualified applications / applications from source * 100', cost_per_hire: 'Intentionally blank until source/channel-level spend is stored; do not substitute job-level spend' }],
    ['rejection_reasons.csv', rejectionHeaders, 'Reason counts for filtered applications currently at Rejected stage.', { share_of_rejections_pct: 'reason count / all rejected applications in this filtered cohort * 100', rejection_population: 'Total rejected applications in the filtered cohort' }],
    ['job_fill_analysis.csv', jobFillHeaders, 'Role-level time-to-fill and age-of-open-role detail.', { days_to_fill: 'First valid hire timestamp minus job created timestamp for jobs considered filled', days_open: 'Export timestamp minus job creation timestamp for open roles', included_in_average_time_to_fill: 'True only where the job is closed, has at least one hire, and has a valid fill duration' }],
    ['timeline_events.csv', timelineHeaders, 'Recorded application event history; a traceability table, not a synthetic history.', { metadata_json: 'JSON-encoded event metadata; schema may vary by event type', derived_stage: 'Stage inferred from the recorded event type/metadata' }],
    ['stage_duration_observations.csv', stageObservationHeaders, 'One measured application-stage interval per eligible recorded transition or stored offer acceptance timestamp.', { duration_days: 'Stage exit timestamp minus stage entry timestamp, expressed in fractional days', evidence_type: 'Recorded timeline event or stored offer acceptance timestamp; generated UI-only timeline events are excluded' }],
    ['stage_duration_summary.csv', stageSummaryHeaders, 'Stage-level mean duration and observation count.', { observation_count: 'Number of per-application stage intervals contributing to the mean' }],
    ['stalled_applications.csv', stalledHeaders, 'Active-stage applications with no update in over 14 days.', { days_inactive: 'Rounded calendar-day distance from updatedAt, or createdAt if updatedAt is unavailable' }],
    ['overdue_evaluations.csv', overdueHeaders, 'Past interviews still lacking recorded evaluation/scorecard.', { days_overdue: 'Export timestamp minus scheduled interview timestamp' }],
    ['scorecards.csv', scorecardHeaders, 'One row per recorded scorecard for filtered applications.', { criteria_json: 'JSON object containing recorded criteria/rating detail where the source record provides it' }],
    ['offer_history.csv', offerHeaders, 'One row per offer history event; offers without history still get one row.', { offer_event_action: 'Recorded offer history action such as created, sent, accepted, or declined' }]
  ];
  for (const [filename, headers, description, definitions] of filesForDictionary) {
    dictionaryRows.push(...describeRows(filename, headers, description, definitions));
  }

  const filterHeaders = ['filter', 'selected_value', 'interpretation'];
  const selectedJob = filters.jobId && filters.jobId !== 'all' ? jobMap.get(filters.jobId) : null;
  const filterRows = [
    ['generated_at_utc', exportTimestamp, 'Export timestamp; inactivity/overdue durations are evaluated against this time.'],
    ['date_range_start', filters.startDate || '', 'Filters application createdAt timestamps; affects application-cohort metrics.'],
    ['date_range_end', filters.endDate || '', 'Filters application createdAt timestamps; affects application-cohort metrics.'],
    ['job_id', filters.jobId || 'all', selectedJob ? `Selected job: ${selectedJob.title || selectedJob.id}` : 'All jobs unless a specific job ID is selected.'],
    ['source', filters.source || 'all', 'Filters application source; empty source values are grouped as Direct Application.'],
    ['status', filters.status || 'all', 'Filters current application stage.'],
    ['recruiter', filters.recruiter || 'all', 'Matches interviewer, evaluator, or timeline performedBy text.'],
    ['filtered_application_count', filteredApplications.length, 'Count after duplicate exclusion and all active dashboard filters.'],
    ['active_application_count_before_filters', activeApplications.length, 'Non-merged application count before date/job/source/status/recruiter filters.'],
    ['jobs_in_fill_cohort', eligibleJobs.length, 'Time-to-fill uses selected job filter only; it intentionally ignores source/status/date/recruiter filters.']
  ];

  const methodology = `TIDAL ATS ANALYST EXPORT\n\nGenerated (UTC): ${exportTimestamp}\n\nPURPOSE\nThis analyst pack provides row-level extracts and calculation provenance for the recruitment analytics dashboard. All CSVs use UTF-8 with a BOM and quoted fields. Join application-level data using application_id.\n\nFILES\n- executive_summary.csv: KPI values, numerators/denominators where applicable, formula/rule, and caveats.\n- application_detail.csv: one row per active, non-merged application after dashboard filters. Names, email addresses, phone numbers, and resume text are intentionally omitted.\n- time_to_hire_observations.csv: exact valid application-to-hire durations used by the time-to-hire mean and median.\n- funnel.csv: candidate counts by achieved stage, conversion denominators, drop-off rates, and pipe-delimited application IDs.\n- funnel_membership.csv: normalized one-row-per-application-and-stage mapping for joins and cohort analysis.\n- source_effectiveness.csv: per-source application, qualification, interview, offer, and hire outcomes.\n- rejection_reasons.csv: normalized rejection reason counts and shares.\n- job_fill_analysis.csv: job lifecycle values and whether each role contributes to average time-to-fill.\n- timeline_events.csv: recorded event history to audit stage movements and timestamp evidence.\n- stage_duration_observations.csv: application-stage intervals behind stage duration averages.\n- stage_duration_summary.csv: mean duration and observation count by stage.\n- stalled_applications.csv: active-stage records inactive for more than 14 days.\n- overdue_evaluations.csv: past interviews without a recorded evaluation/scorecard.\n- scorecards.csv: recorded interview scorecards and criteria JSON where available.\n- offer_history.csv: offer facts repeated for each offer history event to support lifecycle analysis.\n- data_dictionary.csv: column definitions, formulas, and dataset grain.\n- filter_context.csv: effective filters, population counts, and export time.\n\nIMPORTANT DEFINITIONS / CAVEATS\n1. Merged duplicate records are excluded from active recruitment counts. application_id is the join key across files.\n2. Funnel counts mean an application reached a stage, based on current stage and recorded event evidence; they are not mutually exclusive stage buckets. Funnel candidate IDs provide traceability.\n3. Qualified means resume match score >= 70 OR an application reached Shortlisted, Interview Scheduled, Job Offer, or Hired.\n4. Time-to-hire is application createdAt to recorded offer acceptance/hire timestamp. No updatedAt fallback is used; missing evidence stays blank. The mean/median only includes eligible hired applications.\n5. Time-to-fill is job createdAt to the first valid hire timestamp for a closed job with at least one hire. It is a job-level metric and only respects the selected job filter, not application cohort filters. Open roles have age-in-days instead of completed time-to-fill.\n6. Stage duration averages use recorded timeline events and explicit offer-acceptance timestamps. A stage still active at export time is measured to export time. Synthesized UI-only timeline events are not treated as evidence.\n7. Source-level cost-per-hire is deliberately not calculated because source/channel-level spend is not recorded. Job-level sourcing spend cannot be allocated to channels without an explicit allocation rule.\n8. Stalled/overdue metrics are time-sensitive and will change at later exports. Stalled means >14 days since updatedAt (fallback createdAt). Overdue means scheduled interview is in the past and no evaluation rating or scorecard exists.\n9. Blank numeric cells mean unknown/not calculable/not recorded; they are not zeros. Percentages are expressed as percentage points (e.g. 25.0 means 25%). Dates use ISO-8601 UTC.\n10. Candidate contact details and resume contents are not included to reduce exposure of personal data. Share this pack only with authorized HR/data personnel.\n\nQUICK ANALYSIS EXAMPLES\nPython/pandas: read application_detail.csv and time_to_hire_observations.csv as separate dataframes. Group application_detail by source to count distinct application_id and average resume_match_score; use time_to_hire_observations to calculate source-specific mean/median hiring time and join back on application_id.\nFunnel cohort: load funnel_membership.csv and join to application_detail.csv on application_id to analyze which jobs, sources, or scores are associated with stage progression.\nStage velocity: aggregate stage_duration_observations.csv by stage (mean duration_days and count observations), then compare with stage_duration_summary.csv to reconcile calculated results.\n`;

  return {
    'README.txt': methodology,
    'executive_summary.csv': toCsv(summaryHeaders, summaryRows),
    'application_detail.csv': toCsv(applicationHeaders, applicationRows),
    'funnel.csv': toCsv(funnelHeaders, funnelRows),
    'funnel_membership.csv': toCsv(funnelMembershipHeaders, funnelMembershipRows),
    'source_effectiveness.csv': toCsv(sourceHeaders, sourceRows),
    'rejection_reasons.csv': toCsv(rejectionHeaders, rejectionRows),
    'job_fill_analysis.csv': toCsv(jobFillHeaders, jobFillRows),
    'timeline_events.csv': toCsv(timelineHeaders, timelineRows),
    'stage_duration_observations.csv': toCsv(stageObservationHeaders, stageObservationRows),
    'time_to_hire_observations.csv': toCsv(timeToHireHeaders, timeToHireRows),
    'stage_duration_summary.csv': toCsv(stageSummaryHeaders, stageSummaryRows),
    'stalled_applications.csv': toCsv(stalledHeaders, stalledRows),
    'overdue_evaluations.csv': toCsv(overdueHeaders, overdueRows),
    'scorecards.csv': toCsv(scorecardHeaders, scorecardRows),
    'offer_history.csv': toCsv(offerHeaders, offerRows),
    'data_dictionary.csv': toCsv(['file', 'column', 'definition', 'dataset_grain'], dictionaryRows),
    'filter_context.csv': toCsv(filterHeaders, filterRows)
  };
}

// Minimal ZIP writer using Node built-ins only; no runtime ZIP dependency is required.
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

export function createZipArchive(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime(new Date());
  for (const [filename, content] of Object.entries(files)) {
    const name = Buffer.from(filename, 'utf8');
    const raw = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
    const compressed = deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 filename
    local.writeUInt16LE(8, 8); // Deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  const count = Object.keys(files).length;
  end.writeUInt16LE(count, 8);
  end.writeUInt16LE(count, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localData.length, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([localData, centralDirectory, end]);
}

export function generateAnalyticsAnalystPack({ applications = [], jobs = [], filters = {}, analytics } = {}) {
  const files = buildAnalyticsExportFiles({ applications, jobs, filters, analytics });
  return createZipArchive(files);
}
