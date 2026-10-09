import { ensureApplicationTimeline } from './atsHelper.js';

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

  const startMs = startDate ? new Date(startDate).getTime() : 0;
  const endMs = endDate ? new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1) : Infinity;

  // Filter applications by date range, job, source, status, recruiter
  const filteredApps = applications.filter(app => {
    const created = Number(app.createdAt) || 0;
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
    timeline: ensureApplicationTimeline(app),
    job: jobsMap.get(app.jobId) || null
  }));

  // ==========================================
  // 1. RECRUITMENT FUNNEL
  // ==========================================
  const FUNNEL_STAGES = [
    { key: 'Application Submitted', label: 'Applied' },
    { key: 'Initial Screening', label: 'Screened' },
    { key: 'Shortlisted', label: 'Shortlisted' },
    { key: 'Interview Scheduled', label: 'Interviewed' },
    { key: 'Job Offer', label: 'Offered' },
    { key: 'Hired', label: 'Hired' }
  ];

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
      if (targetStage === 'Initial Screening' && (app.geminiScore != null || app.timeline.some(t => t.type === 'screening_completed' || t.metadata?.stage === 'Initial Screening'))) return true;
      if (targetStage === 'Shortlisted' && app.timeline.some(t => t.metadata?.stage === 'Shortlisted')) return true;
      if (targetStage === 'Interview Scheduled' && (app.interview?.scheduledAt || app.timeline.some(t => t.type === 'interview_scheduled' || t.metadata?.stage === 'Interview Scheduled'))) return true;
      if (targetStage === 'Job Offer' && (app.offer || app.timeline.some(t => t.type?.startsWith('offer_') || t.metadata?.stage === 'Job Offer'))) return true;
      if (targetStage === 'Hired' && (app.stage === 'Hired' || app.timeline.some(t => t.type === 'offer_accepted' || t.metadata?.stage === 'Hired'))) return true;
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
    let reason = 'Did Not Meet Role Criteria';
    if (app.recruiterNotes) {
      const lower = app.recruiterNotes.toLowerCase();
      if (lower.includes('salary') || lower.includes('compensation')) reason = 'Compensation Mismatch';
      else if (lower.includes('experience') || lower.includes('junior') || lower.includes('years')) reason = 'Insufficient Experience';
      else if (lower.includes('skill') || lower.includes('tech')) reason = 'Technical Skills Gap';
      else if (lower.includes('culture') || lower.includes('communication')) reason = 'Culture / Soft Skills';
      else if (lower.includes('withdrew') || lower.includes('declined')) reason = 'Candidate Withdrew';
      else reason = app.recruiterNotes.slice(0, 45);
    } else if (app.geminiScore != null && app.geminiScore < 60) {
      reason = 'Low Resume Match Score';
    }
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
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Time to hire (for Hired candidates)
  const hiredApps = appsWithTimeline.filter(a => a.stage === 'Hired');
  const timeToHireDaysList = hiredApps.map(app => {
    const hiredEvent = app.timeline.find(t => t.metadata?.stage === 'Hired' || t.type === 'offer_accepted');
    const hiredAt = hiredEvent ? hiredEvent.timestamp : Number(app.updatedAt) || now;
    const created = Number(app.createdAt) || hiredAt;
    const days = Math.max(1, Math.round((hiredAt - created) / DAY_MS));
    return days;
  }).sort((a, b) => a - b);

  const avgTimeToHire = timeToHireDaysList.length > 0
    ? Number((timeToHireDaysList.reduce((acc, d) => acc + d, 0) / timeToHireDaysList.length).toFixed(1))
    : 0;

  const medianTimeToHire = timeToHireDaysList.length > 0
    ? (timeToHireDaysList.length % 2 === 0
      ? Number(((timeToHireDaysList[timeToHireDaysList.length / 2 - 1] + timeToHireDaysList[timeToHireDaysList.length / 2]) / 2).toFixed(1))
      : timeToHireDaysList[Math.floor(timeToHireDaysList.length / 2)])
    : 0;

  // Time to fill per job
  const timeToFillByJob = jobs.map(job => {
    const jobHires = hiredApps.filter(a => a.jobId === job.id);
    const created = Number(job.createdAt) || now;
    let daysToFill = null;
    let isFilled = false;

    if (jobHires.length > 0) {
      const latestHireTime = Math.max(...jobHires.map(a => Number(a.updatedAt) || now));
      daysToFill = Math.max(1, Math.round((latestHireTime - created) / DAY_MS));
      isFilled = true;
    } else if (job.status === 'closed') {
      const closedAt = Number(job.updatedAt) || now;
      daysToFill = Math.max(1, Math.round((closedAt - created) / DAY_MS));
      isFilled = true;
    } else {
      daysToFill = Math.max(1, Math.round((now - created) / DAY_MS));
      isFilled = false;
    }

    return {
      jobId: job.id,
      jobTitle: job.title,
      department: job.department,
      status: job.status,
      hiresCount: jobHires.length,
      daysToFill,
      isFilled
    };
  });

  const avgTimeToFill = timeToFillByJob.filter(j => j.isFilled).length > 0
    ? Number((timeToFillByJob.filter(j => j.isFilled).reduce((a, b) => a + b.daysToFill, 0) / timeToFillByJob.filter(j => j.isFilled).length).toFixed(1))
    : (timeToFillByJob.length > 0 ? Number((timeToFillByJob.reduce((a, b) => a + b.daysToFill, 0) / timeToFillByJob.length).toFixed(1)) : 0);

  // Time spent in each recruitment stage
  const stageDurationTotals = {
    'Application Submitted': [],
    'Initial Screening': [],
    'Shortlisted': [],
    'Interview Scheduled': [],
    'Job Offer': []
  };

  appsWithTimeline.forEach(app => {
    const events = [...(app.timeline || [])].sort((a, b) => a.timestamp - b.timestamp);
    for (let i = 0; i < events.length; i++) {
      const curr = events[i];
      const stageName = curr.metadata?.stage || (curr.type === 'application_submitted' ? 'Application Submitted' : curr.type === 'interview_scheduled' ? 'Interview Scheduled' : null);
      if (stageName && stageDurationTotals[stageName]) {
        const nextTime = i + 1 < events.length ? events[i + 1].timestamp : Number(app.updatedAt) || now;
        const diffDays = Math.max(0.5, Number(((nextTime - curr.timestamp) / DAY_MS).toFixed(1)));
        stageDurationTotals[stageName].push(diffDays);
      }
    }
  });

  const averageStageDurations = Object.entries(stageDurationTotals).map(([stageName, durations]) => {
    const avgDays = durations.length > 0
      ? Number((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1))
      : 3.5; // reasonable baseline if stage was skipped or instantly moved
    return {
      stage: stageName,
      averageDays: avgDays,
      dataPoints: durations.length
    };
  });

  // Stalled applications (in progress stages without activity for > 14 days)
  const ACTIVE_STAGES = ['Application Submitted', 'Initial Screening', 'Shortlisted', 'Interview Scheduled', 'Job Offer'];
  const STALLED_THRESHOLD_MS = 14 * DAY_MS;

  const stalledApplications = appsWithTimeline
    .filter(app => ACTIVE_STAGES.includes(app.stage))
    .filter(app => {
      const lastActive = Number(app.updatedAt) || Number(app.createdAt) || 0;
      return (now - lastActive) > STALLED_THRESHOLD_MS;
    })
    .map(app => {
      const lastActive = Number(app.updatedAt) || Number(app.createdAt) || 0;
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
    .filter(app => app.interview?.scheduledAt)
    .filter(app => {
      const interviewTime = new Date(app.interview.scheduledAt).getTime();
      const hasEvaluation = Boolean(app.evaluation?.rating) || (Array.isArray(app.scorecards) && app.scorecards.length > 0);
      return interviewTime < now && !hasEvaluation;
    })
    .map(app => {
      const interviewTime = new Date(app.interview.scheduledAt).getTime();
      const daysOverdue = Math.max(1, Math.round((now - interviewTime) / DAY_MS));
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
      const hiredEvent = app.timeline.find(t => t.metadata?.stage === 'Hired' || t.type === 'offer_accepted');
      const hiredAt = hiredEvent ? hiredEvent.timestamp : Number(app.updatedAt) || now;
      const created = Number(app.createdAt) || hiredAt;
      item.timeToHireList.push(Math.max(1, Math.round((hiredAt - created) / DAY_MS)));
    }
  });

  // Calculate total sourcing costs across jobs
  const totalSourcingCost = jobs.reduce((sum, j) => sum + (Number(j.sourcingCost) || 0), 0);

  const sourceEffectiveness = Object.values(sourcesMap).map(src => {
    const qualRate = src.applications > 0 ? Number(((src.qualified / src.applications) * 100).toFixed(1)) : 0;
    const interviewRate = src.applications > 0 ? Number(((src.interviews / src.applications) * 100).toFixed(1)) : 0;
    const offerRate = src.applications > 0 ? Number(((src.offers / src.applications) * 100).toFixed(1)) : 0;
    const hireRate = src.applications > 0 ? Number(((src.hires / src.applications) * 100).toFixed(1)) : 0;
    const avgSourceTimeToHire = src.timeToHireList.length > 0
      ? Number((src.timeToHireList.reduce((a, b) => a + b, 0) / src.timeToHireList.length).toFixed(1))
      : 0;

    // Cost per hire: if sourcing cost exists, distribute proportionally or per hire
    let costPerHire = null;
    if (totalSourcingCost > 0 && src.hires > 0) {
      const share = src.applications / Math.max(1, appsWithTimeline.length);
      const allocatedCost = totalSourcingCost * share;
      costPerHire = Math.round(allocatedCost / src.hires);
    }

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
  const offerAcceptanceRate = funnelSteps[4]?.count > 0
    ? Number(((totalHires / funnelSteps[4].count) * 100).toFixed(1))
    : 0;

  return {
    summary: {
      totalApplications: appsWithTimeline.length,
      totalHires,
      avgTimeToHire,
      medianTimeToHire,
      avgTimeToFill,
      offerAcceptanceRate,
      stalledCount: stalledApplications.length,
      overdueEvaluationsCount: overdueEvaluations.length
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
  lines.push(`Avg Time to Hire (Days),${analytics.summary.avgTimeToHire}`);
  lines.push(`Median Time to Hire (Days),${analytics.summary.medianTimeToHire}`);
  lines.push(`Avg Time to Fill (Days),${analytics.summary.avgTimeToFill}`);
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
    lines.push(`"${s.source}",${s.applications},${s.qualified},${s.qualifiedRate}%,${s.interviews},${s.interviewRate}%,${s.offers},${s.offerRate}%,${s.hires},${s.hireRate}%,${s.avgTimeToHire},${s.costPerHire != null ? `₱${s.costPerHire}` : 'N/A'}`);
  });
  lines.push('');

  // 5. Time in Stages
  lines.push('--- AVERAGE DURATION PER RECRUITMENT STAGE ---');
  lines.push('Stage,Average Duration (Days)');
  ((analytics.speed && analytics.speed.averageStageDurations) || []).forEach(sd => {
    lines.push(`"${sd.stage}",${sd.averageDays}`);
  });

  return lines.join('\n');
}
