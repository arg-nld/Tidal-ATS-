import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAnalytics } from '../services/analyticsService.js';

const DAY_MS = 24 * 60 * 60 * 1000;

test('analytics excludes merged duplicates and uses recorded hire, fill, and rejection data', () => {
  const now = Date.now();
  const appliedAt = now - 10 * DAY_MS;
  const hiredAt = now - 2 * DAY_MS;
  const applications = [
    {
      id: 'hired-1',
      jobId: 'job-1',
      name: 'Alex Rivera',
      email: 'alex@example.com',
      source: 'LinkedIn',
      stage: 'Hired',
      createdAt: appliedAt,
      updatedAt: now,
      offer: {
        status: 'accepted',
        candidateRespondedAt: hiredAt,
        history: [{ action: 'accepted', timestamp: hiredAt }]
      },
      timeline: [
        { type: 'application_submitted', timestamp: appliedAt },
        { type: 'stage_changed', timestamp: appliedAt + DAY_MS, metadata: { toStage: 'Initial Screening' } },
        { type: 'stage_changed', timestamp: appliedAt + 3 * DAY_MS, metadata: { toStage: 'Shortlisted' } },
        { type: 'stage_changed', timestamp: appliedAt + 4 * DAY_MS, metadata: { toStage: 'Interview Scheduled' } },
        { type: 'stage_changed', timestamp: appliedAt + 6 * DAY_MS, metadata: { toStage: 'Job Offer' } },
        { type: 'offer_accepted', timestamp: hiredAt }
      ]
    },
    {
      id: 'rejected-1',
      jobId: 'job-1',
      source: 'Company Careers',
      stage: 'Rejected',
      createdAt: now - 8 * DAY_MS,
      updatedAt: now - 7 * DAY_MS,
      rejectionReason: 'Skills mismatch'
    },
    {
      id: 'merged-1',
      jobId: 'job-1',
      source: 'LinkedIn',
      stage: 'Archived (Duplicate Merged)',
      mergedInto: 'hired-1',
      createdAt: appliedAt,
      updatedAt: now
    }
  ];
  const jobs = [{ id: 'job-1', title: 'Engineer', department: 'Engineering', status: 'closed', createdAt: now - 20 * DAY_MS, sourcingCost: 50000 }];

  const analytics = calculateAnalytics({ applications, jobs });

  assert.equal(analytics.summary.totalApplications, 2, 'merged duplicate must not inflate application count');
  assert.equal(analytics.summary.totalHires, 1);
  assert.equal(analytics.summary.avgTimeToHire, 8);
  assert.equal(analytics.summary.medianTimeToHire, 8);
  assert.equal(analytics.summary.avgTimeToFill, 18);
  assert.equal(analytics.summary.offerAcceptanceRate, 100);
  assert.deepEqual(analytics.rejectionReasons.map(item => item.reason), ['Skills mismatch']);

  const linkedIn = analytics.sources.find(item => item.source === 'LinkedIn');
  assert.equal(linkedIn.applications, 1);
  assert.equal(linkedIn.avgTimeToHire, 8);
  assert.equal(linkedIn.costPerHire, null, 'job-level spend must not be fabricated into a channel-level cost');

  const durations = Object.fromEntries(analytics.speed.averageStageDurations.map(item => [item.stage, item]));
  assert.equal(durations['Application Submitted'].averageDays, 1);
  assert.equal(durations['Initial Screening'].averageDays, 2);
  assert.equal(durations['Shortlisted'].averageDays, 1);
  assert.equal(durations['Interview Scheduled'].averageDays, 2);
  assert.equal(durations['Job Offer'].averageDays, 2);
});

test('analytics reports missing duration history instead of inventing averages', () => {
  const now = Date.now();
  const analytics = calculateAnalytics({
    applications: [{
      id: 'hire-without-history',
      jobId: 'job-1',
      source: 'Direct Application',
      stage: 'Hired',
      createdAt: now - 5 * DAY_MS,
      updatedAt: now,
      timeline: []
    }],
    jobs: [{ id: 'job-1', title: 'Engineer', status: 'closed', createdAt: now - 20 * DAY_MS, sourcingCost: 1000 }]
  });

  assert.equal(analytics.summary.totalHires, 1);
  assert.equal(analytics.summary.avgTimeToHire, null);
  assert.equal(analytics.summary.medianTimeToHire, null);
  assert.equal(analytics.summary.avgTimeToFill, null);
  assert.equal(analytics.sources[0].avgTimeToHire, null);
  assert.equal(analytics.sources[0].costPerHire, null);
  assert.ok(analytics.speed.averageStageDurations.every(item => item.averageDays === null && item.dataPoints === 0));
  assert.equal(analytics.speed.timeToFillByJob[0].daysToFill, null);
});


test('time-to-fill uses the first recorded hire date for a filled job', () => {
  const now = Date.now();
  const openedAt = now - 30 * DAY_MS;
  const firstHireAt = now - 20 * DAY_MS;
  const secondHireAt = now - 5 * DAY_MS;
  const analytics = calculateAnalytics({
    applications: [
      {
        id: 'first-hire', jobId: 'job-multi', stage: 'Hired', createdAt: openedAt + DAY_MS,
        offer: { status: 'accepted', acceptedAt: firstHireAt }, timeline: []
      },
      {
        id: 'second-hire', jobId: 'job-multi', stage: 'Hired', createdAt: openedAt + 2 * DAY_MS,
        offer: { status: 'accepted', acceptedAt: secondHireAt }, timeline: []
      }
    ],
    jobs: [{ id: 'job-multi', title: 'Engineer', status: 'closed', createdAt: openedAt }]
  });

  assert.equal(analytics.summary.avgTimeToFill, 10);
  assert.equal(analytics.speed.timeToFillByJob[0].daysToFill, 10);
  assert.equal(analytics.speed.timeToFillByJob[0].hiresCount, 2);
});
