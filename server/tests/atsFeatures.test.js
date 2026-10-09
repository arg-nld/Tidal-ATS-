import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTimelineEvent,
  ensureApplicationTimeline,
  detectCandidateSimilarity,
  calculateScorecardSummary
} from '../services/atsHelper.js';
import {
  calculateAnalytics,
  generateAnalyticsCsv
} from '../services/analyticsService.js';
import { Store } from '../services/store.js';
import fs from 'node:fs';
import path from 'node:path';

test('Candidate Activity Timeline: event creation and synthesis', () => {
  const event = createTimelineEvent({
    type: 'stage_changed',
    title: 'Advanced to Interview Scheduled',
    description: 'Candidate passed initial phone screening',
    performedBy: 'Sarah Lin',
    performedByRole: 'hr',
    metadata: { previousStage: 'Initial Screening', newStage: 'Interview Scheduled' }
  });

  assert.equal(event.type, 'stage_changed');
  assert.equal(event.title, 'Advanced to Interview Scheduled');
  assert.equal(event.performedBy, 'Sarah Lin');
  assert.equal(event.performedByRole, 'hr');
  assert.ok(event.timestamp);
  assert.equal(event.metadata.newStage, 'Interview Scheduled');

  // Test legacy timeline synthesis
  const legacyApp = {
    id: 'app-legacy',
    createdAt: Date.now() - 86400000 * 5,
    stage: 'Interview Scheduled',
    geminiScore: 85,
    interview: {
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      interviewer: 'David Chen'
    },
    timeline: []
  };

  const synthesized = ensureApplicationTimeline(legacyApp);
  assert.ok(synthesized.length >= 3, 'Should synthesize submission, screening, and interview events');
  assert.equal(synthesized[0].type, 'application_submitted');
});

test('Interview Scorecards: criteria scoring and HR aggregation', () => {
  const scorecard1 = {
    id: 'sc-1',
    interviewerName: 'Sarah Lin',
    interviewerRole: 'Lead Recruiter',
    recommendation: 'Strong Hire',
    overallRating: 5,
    criteriaRatings: [
      { criterionId: 'crit-tech', criterionName: 'Technical Competency', score: 5 },
      { criterionId: 'crit-comm', criterionName: 'Communication', score: 4 }
    ],
    generalNotes: 'Top tier engineer'
  };

  const scorecard2 = {
    id: 'sc-2',
    interviewerName: 'Mark Chen',
    interviewerRole: 'Engineering Manager',
    recommendation: 'Hire',
    overallRating: 4,
    criteriaRatings: [
      { criterionId: 'crit-tech', criterionName: 'Technical Competency', score: 4 },
      { criterionId: 'crit-comm', criterionName: 'Communication', score: 4 }
    ],
    generalNotes: 'Recommended'
  };

  const summary = calculateScorecardSummary([scorecard1, scorecard2]);
  assert.equal(summary.count, 2);
  assert.equal(summary.averageRating, 4.5);
  assert.equal(summary.recommendationBreakdown['Strong Hire'], 1);
  assert.equal(summary.recommendationBreakdown['Hire'], 1);
  assert.equal(summary.criteriaAverages['Technical Competency'], 4.5);
  assert.equal(summary.criteriaAverages['Communication'], 4.0);
  assert.ok(summary.consensus.includes('Hire'));
});

test('Duplicate Candidate Detection: similarity matching by email, phone, and name', () => {
  const target = {
    id: 'cand-target',
    name: 'Andrei Reginald Co',
    email: 'andreireginaldc.co@gmail.com',
    phone: '+63 917 123 4567',
    jobId: 'job-1'
  };

  const dup1 = {
    id: 'cand-dup-1',
    name: 'Andrei R. Co',
    email: 'andreireginaldc.co@gmail.com',
    phone: '+63 917 123 4567'
  };

  const dup2 = {
    id: 'cand-dup-2',
    name: 'Andrei Co',
    email: 'andrei.other@gmail.com',
    phone: '0917-123-4567'
  };

  const distinct = {
    id: 'cand-diff',
    name: 'Maria Santos',
    email: 'maria.santos@yahoo.com',
    phone: '+63 918 999 8888'
  };

  const match1 = detectCandidateSimilarity(target, dup1);
  assert.ok(match1);
  assert.equal(match1.confidence, 100);
  assert.ok(match1.reasons.includes('Identical Email Address'));

  const match2 = detectCandidateSimilarity(target, dup2);
  assert.ok(match2);
  assert.ok(match2.confidence >= 80);
  assert.ok(match2.reasons.includes('Matching Phone Number'));

  const matchDistinct = detectCandidateSimilarity(target, distinct);
  assert.equal(matchDistinct, null);
});

test('Duplicate Candidate Merging: safely consolidates applications, scorecards, notes, and timeline', () => {
  const tmpDbPath = path.resolve('server/data/test_db_merge.json');
  try {
    const store = new Store(tmpDbPath);

    const primaryApp = store.createApplication({
      jobId: 'job-100',
      userId: 'user-1',
      name: 'Alex Rivera',
      email: 'alex.rivera@gmail.com',
      phone: '+63 917 555 1234',
      stage: 'Interview Scheduled',
      recruiterNotes: 'Primary application note'
    });

    const duplicateApp = store.createApplication({
      jobId: 'job-200',
      userId: 'user-2',
      name: 'Alexander Rivera',
      email: 'alex.rivera@gmail.com',
      phone: '+63 917 555 1234',
      stage: 'Initial Screening',
      recruiterNotes: 'Duplicate application note from previous cycle',
      scorecards: [
        {
          id: 'sc-dup-1',
          interviewerName: 'Tech Lead',
          overallRating: 5,
          recommendation: 'Strong Hire'
        }
      ]
    });

    const merged = store.mergeApplications(primaryApp.id, duplicateApp.id, {
      name: 'HR Admin'
    });

    assert.equal(merged.id, primaryApp.id);
    assert.ok(merged.recruiterNotes.includes('Duplicate application note'));
    assert.equal(merged.scorecards.length, 1);
    assert.equal(merged.scorecards[0].id, 'sc-dup-1');
    assert.ok(merged.timeline.some(e => e.type === 'candidate_merged'));

    // Check duplicate marked as merged
    const updatedDup = store.getApplicationById(duplicateApp.id);
    assert.equal(updatedDup.mergedInto, primaryApp.id);
    assert.equal(updatedDup.stage, 'Archived (Duplicate Merged)');
  } finally {
    if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath);
  }
});

test('Offer Management: creation, approval, dispatch, and candidate response', () => {
  const tmpDbPath = path.resolve('server/data/test_db_offer.json');
  try {
    const store = new Store(tmpDbPath);

    const app = store.createApplication({
      jobId: 'job-offer-test',
      name: 'Jessica Ramos',
      email: 'jessica.ramos@example.com',
      stage: 'Job Offer'
    });

    // Create draft offer
    const offerData = {
      compensation: { amount: 150000, currency: '₱', period: '/ month' },
      proposedStartDate: '2026-11-01',
      expiryDate: '2026-10-25',
      notes: 'Sign-on bonus included'
    };

    let updated = store.updateApplication(app.id, {
      offer: {
        ...offerData,
        status: 'draft',
        createdAt: new Date().toISOString(),
        history: [{ action: 'created', timestamp: new Date().toISOString(), actor: { name: 'Recruiter' } }]
      }
    });

    assert.equal(updated.offer.status, 'draft');
    assert.equal(updated.offer.compensation.amount, 150000);

    // Approve offer
    updated = store.updateApplication(app.id, {
      offer: {
        ...updated.offer,
        status: 'approved',
        approvedBy: { name: 'VP Talent' },
        approvedAt: new Date().toISOString()
      }
    });
    assert.equal(updated.offer.status, 'approved');

    // Send offer to candidate
    updated = store.updateApplication(app.id, {
      offer: {
        ...updated.offer,
        status: 'sent',
        sentAt: new Date().toISOString()
      }
    });
    assert.equal(updated.offer.status, 'sent');

    // Candidate accepts offer -> application moves to Hired
    updated = store.updateApplication(app.id, {
      stage: 'Hired',
      offer: {
        ...updated.offer,
        status: 'accepted',
        candidateRespondedAt: new Date().toISOString(),
        candidateComment: 'Honored to accept!'
      }
    });
    assert.equal(updated.stage, 'Hired');
    assert.equal(updated.offer.status, 'accepted');
  } finally {
    if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath);
  }
});

test('HR Analytics Dashboard: funnel, speed, stage velocity, stalled apps, sourcing ROI, and CSV export', () => {
  const jobs = [
    { id: 'job-1', title: 'Senior Backend Engineer', sourcingCost: 50000, status: 'open' },
    { id: 'job-2', title: 'Lead Designer', sourcingCost: 30000, status: 'open' }
  ];

  const now = Date.now();
  const applications = [
    {
      id: 'app-1',
      jobId: 'job-1',
      source: 'LinkedIn',
      stage: 'Hired',
      createdAt: now - 86400000 * 20,
      updatedAt: now,
      timeline: [
        { type: 'application_submitted', timestamp: now - 86400000 * 20 },
        { type: 'stage_changed', metadata: { stage: 'Initial Screening' }, timestamp: now - 86400000 * 18 },
        { type: 'stage_changed', metadata: { stage: 'Shortlisted' }, timestamp: now - 86400000 * 15 },
        { type: 'stage_changed', metadata: { stage: 'Interview Scheduled' }, timestamp: now - 86400000 * 10 },
        { type: 'stage_changed', metadata: { stage: 'Job Offer' }, timestamp: now - 86400000 * 5 },
        { type: 'stage_changed', metadata: { stage: 'Hired' }, timestamp: now }
      ],
      scorecards: [{ recommendation: 'Strong Hire', overallRating: 5 }]
    },
    {
      id: 'app-2', // Stalled application (>14d without update)
      jobId: 'job-1',
      source: 'JobStreet',
      stage: 'Initial Screening',
      createdAt: now - 86400000 * 30,
      updatedAt: now - 86400000 * 25
    },
    {
      id: 'app-3', // Overdue evaluation
      jobId: 'job-2',
      source: 'Employee Referral',
      stage: 'Interview Scheduled',
      createdAt: now - 86400000 * 10,
      interview: {
        scheduledAt: new Date(now - 86400000 * 3).toISOString(), // 3 days ago
        interviewer: 'Dan Garcia'
      },
      scorecards: [] // No scorecard submitted yet
    },
    {
      id: 'app-4', // Rejected
      jobId: 'job-1',
      source: 'Company Careers',
      stage: 'Rejected',
      rejectionReason: 'Skills Mismatch',
      createdAt: now - 86400000 * 12,
      updatedAt: now - 86400000 * 8
    }
  ];

  const analytics = calculateAnalytics({ applications, jobs, filters: {} });

  // Funnel assertions
  assert.equal(analytics.summary.totalApplications, 4);
  assert.equal(analytics.summary.totalHires, 1);
  assert.equal(analytics.funnel[0].count, 4); // Applied
  assert.equal(analytics.funnel[5].count, 1); // Hired

  // Speed assertions
  assert.ok(analytics.speed.avgTimeToHire >= 0);
  assert.ok(analytics.speed.medianTimeToHire >= 0);

  // Stalled applications
  assert.ok(analytics.speed.stalledApplications.length >= 1);
  assert.equal(analytics.speed.stalledApplications[0].id, 'app-2');

  // Overdue evaluations
  assert.ok(analytics.speed.overdueEvaluations.length >= 1);
  assert.equal(analytics.speed.overdueEvaluations[0].id, 'app-3');

  // Sourcing effectiveness
  const linkedInSource = analytics.sources.find(s => s.source === 'LinkedIn');
  assert.ok(linkedInSource);
  assert.equal(linkedInSource.hires, 1);
  assert.equal(linkedInSource.hireRate, 100);

  // CSV generation
  const csv = generateAnalyticsCsv(analytics);
  assert.ok(csv.includes('TIDAL ATS - RECRUITMENT ANALYTICS & HR REPORT'));
  assert.ok(csv.includes('EXECUTIVE SUMMARY'));
  assert.ok(csv.includes('RECRUITMENT FUNNEL'));
  assert.ok(csv.includes('SOURCE EFFECTIVENESS'));
});
