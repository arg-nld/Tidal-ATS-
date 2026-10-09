import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../services/store.js';

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tidal-ats-email-queue-'));
  const store = new Store({
    dataDir: dir,
    dbFile: path.join(dir, 'db.json'),
    backupDir: path.join(dir, 'backups'),
    backupIntervalMs: 30_000
  });
  return { dir, store };
}

test('JSON email queue survives store restart and deduplicates the same email log', async () => {
  const { dir, store } = tempStore();
  try {
    const log = store.createEmailLog({
      idempotencyKey: 'test/email-queue/restart',
      to: ['candidate@example.test'],
      subject: 'Queue persistence test',
      status: 'queued'
    });
    const first = await store.enqueueEmail({
      emailLogId: log.id,
      payload: { to: ['candidate@example.test'], subject: 'Queue persistence test', body: 'Test' }
    });
    const second = await store.enqueueEmail({
      emailLogId: log.id,
      payload: { to: ['candidate@example.test'], subject: 'Duplicate', body: 'Should not replace pending job' }
    });

    assert.equal(second.id, first.id);
    assert.equal(second.deduplicated, true);

    const reopened = new Store({
      dataDir: dir,
      dbFile: path.join(dir, 'db.json'),
      backupDir: path.join(dir, 'backups'),
      backupIntervalMs: 30_000
    });
    assert.equal(reopened.data.emailQueue.length, 1);
    assert.equal(reopened.data.emailQueue[0].id, first.id);
    assert.equal(reopened.data.emailQueue[0].payload.subject, 'Queue persistence test');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('JSON email queue reclaims abandoned processing jobs after their lease expires', async () => {
  const { dir, store } = tempStore();
  const previousLease = process.env.EMAIL_WORKER_LEASE_MS;
  const previousRetries = process.env.EMAIL_MAX_RETRIES;
  try {
    process.env.EMAIL_WORKER_LEASE_MS = '60000';
    process.env.EMAIL_MAX_RETRIES = '3';
    const log = store.createEmailLog({
      idempotencyKey: 'test/email-queue/stale',
      to: ['candidate@example.test'],
      subject: 'Stale lease test',
      status: 'queued'
    });
    const queued = await store.enqueueEmail({
      emailLogId: log.id,
      payload: { to: ['candidate@example.test'], subject: 'Stale lease test', body: 'Test' }
    });
    const item = store.data.emailQueue.find(job => job.id === queued.id);
    item.status = 'processing';
    item.lockedAt = Date.now() - 120_000;
    store.save();

    const claimed = await store.claimEmailJobs(1);
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0].id, queued.id);
    assert.equal(claimed[0].attempts, 1);
    assert.equal(item.status, 'processing');
    assert.equal(item.lockedAt > Date.now() - 5_000, true);
    assert.equal(store.getEmailLogs().find(entry => entry.id === log.id).attempts, 1);
  } finally {
    if (previousLease === undefined) delete process.env.EMAIL_WORKER_LEASE_MS;
    else process.env.EMAIL_WORKER_LEASE_MS = previousLease;
    if (previousRetries === undefined) delete process.env.EMAIL_MAX_RETRIES;
    else process.env.EMAIL_MAX_RETRIES = previousRetries;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
