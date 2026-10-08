import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../services/store.js';

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tidal-ats-store-'));
  return { dir, store: new Store({ dataDir: dir, dbFile: path.join(dir, 'db.json'), backupDir: path.join(dir, 'backups'), backupIntervalMs: 30_000 }) };
}

test('store creates database with atomic persistence and backup directory', () => {
  const { dir, store } = tempStore();
  try {
    assert.equal(fs.existsSync(path.join(dir, 'db.json')), true);
    assert.equal(fs.existsSync(path.join(dir, 'backups')), true);
    store.createBackup('test');
    assert.equal(store.getPersistenceStatus().backupCount >= 1, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('store recovers from the latest valid backup when db.json is corrupted', () => {
  const { dir, store } = tempStore();
  try {
    store.updateJob('job-01', { title: 'Backup Recovery Sentinel' });
    store.createBackup('test-recovery');
    const dbPath = path.join(dir, 'db.json');
    fs.writeFileSync(dbPath, '{broken json', 'utf8');
    const recovered = new Store({ dataDir: dir, dbFile: dbPath, backupDir: path.join(dir, 'backups'), backupIntervalMs: 30_000 });
    assert.equal(recovered.getJobById('job-01')?.title, 'Backup Recovery Sentinel');
    assert.equal(fs.readFileSync(dbPath, 'utf8').startsWith('{broken'), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('interview scheduling update rejects conflicts and succeeds for open slots', () => {
  const { dir, store } = tempStore();
  try {
    const first = store.getApplicationById('app-01');
    const result = store.scheduleInterviewIfAvailable('app-02', { scheduledAt: first.interview.scheduledAt });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'conflict');

    const open = store.scheduleInterviewIfAvailable('app-02', { scheduledAt: '2099-01-01T10:00:00.000Z' });
    assert.equal(open.ok, true);
    assert.equal(open.application.interview.scheduledAt, '2099-01-01T10:00:00.000Z');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
