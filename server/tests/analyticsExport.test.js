import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnalyticsExportFiles, generateAnalyticsAnalystPack } from '../services/analyticsExportService.js';

const DAY = 24 * 60 * 60 * 1000;

test('analyst export contains row-level source data, lineage, methodology, and data dictionary', () => {
  const now = Date.now();
  const application = {
    id: 'app-001', jobId: 'job-001', name: 'Sample Candidate', email: 'candidate@example.com',
    source: 'LinkedIn', stage: 'Hired', createdAt: now - 8 * DAY, updatedAt: now,
    geminiScore: 82, scorecards: [{ id: 'sc-1', overallRating: 4, recommendation: 'Hire', criteria: { technical: 4 } }],
    offer: { status: 'accepted', compensation: { amount: 100000, currency: 'PHP', period: 'monthly' }, acceptedAt: now - DAY,
      history: [{ action: 'created', timestamp: now - 2 * DAY }, { action: 'accepted', timestamp: now - DAY }] },
    timeline: [
      { id: 'event-1', type: 'application_submitted', timestamp: now - 8 * DAY, title: 'Application Submitted', metadata: { candidateEmail: 'candidate@example.com', candidateName: 'Sample Candidate', toStage: 'Application Submitted' } },
      { id: 'event-2', type: 'stage_changed', timestamp: now - 6 * DAY, title: 'Advanced', metadata: { toStage: 'Shortlisted' } },
      { id: 'event-3', type: 'stage_changed', timestamp: now - 3 * DAY, title: 'Advanced', metadata: { toStage: 'Job Offer' } },
      { id: 'event-4', type: 'offer_accepted', timestamp: now - DAY, title: 'Offer Accepted', metadata: {} }
    ]
  };
  const jobs = [{ id: 'job-001', title: 'Analyst', department: 'Data', status: 'closed', createdAt: now - 20 * DAY }];
  const files = buildAnalyticsExportFiles({ applications: [application], jobs, filters: {} });
  const expected = [
    'README.txt', 'executive_summary.csv', 'application_detail.csv', 'funnel.csv', 'funnel_membership.csv', 'source_effectiveness.csv',
    'rejection_reasons.csv', 'job_fill_analysis.csv', 'timeline_events.csv', 'stage_duration_observations.csv', 'time_to_hire_observations.csv',
    'stage_duration_summary.csv', 'stalled_applications.csv', 'overdue_evaluations.csv', 'scorecards.csv',
    'offer_history.csv', 'data_dictionary.csv', 'filter_context.csv'
  ];
  for (const file of expected) assert.ok(files[file], `missing ${file}`);
  assert.match(files['application_detail.csv'], /resume_match_score/);
  assert.match(files['application_detail.csv'], /"app-001"/);
  assert.doesNotMatch(files['application_detail.csv'], /candidate@example\.com|Sample Candidate/);
  assert.doesNotMatch(files['timeline_events.csv'], /candidate@example\.com|Sample Candidate/);
  assert.match(files['timeline_events.csv'], /"offer_accepted"/);
  assert.match(files['stage_duration_observations.csv'], /duration_days/);
  assert.doesNotMatch(files['stage_duration_observations.csv'], /\"Hired\"/);
  assert.match(files['time_to_hire_observations.csv'], /hire_timestamp_utc/);
  assert.match(files['executive_summary.csv'], /numerator/);
  assert.match(files['executive_summary.csv'], /denominator/);
  assert.match(files['data_dictionary.csv'], /share_of_rejections_pct/);
  assert.match(files['README.txt'], /Source-level cost-per-hire is deliberately not calculated/);
});

test('analyst pack is a valid ZIP file with the expected ZIP signatures', () => {
  const zip = generateAnalyticsAnalystPack({
    applications: [{ id: 'app-001', jobId: 'job-001', stage: 'Application Submitted', createdAt: Date.now(), timeline: [] }],
    jobs: [{ id: 'job-001', title: 'Analyst', status: 'open', createdAt: Date.now() }],
    filters: {}
  });
  assert.ok(Buffer.isBuffer(zip));
  assert.equal(zip.readUInt32LE(0), 0x04034b50, 'local ZIP header');
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50, 'ZIP end-of-central-directory header');
});
