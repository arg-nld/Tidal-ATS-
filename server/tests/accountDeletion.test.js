import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../services/store.js';
import { hashPassword } from '../services/passwordService.js';

function createIsolatedStore() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tidal-account-delete-'));
  return {
    dataDir,
    store: new Store({ dataDir, dbFile: path.join(dataDir, 'db.json'), backupDir: path.join(dataDir, 'backups') })
  };
}

test('deleting an applicant account removes its applications and sessions, but preserves other candidates and shared jobs', () => {
  const { dataDir, store } = createIsolatedStore();
  try {
    const applicant = store.createUser({ id: 'applicant-one', name: 'Applicant One', email: 'one@example.com', role: 'applicant', passwordHash: hashPassword('Passw0rd!'), emailVerified: true });
    const otherApplicant = store.createUser({ id: 'applicant-two', name: 'Applicant Two', email: 'two@example.com', role: 'applicant', passwordHash: hashPassword('Passw0rd!'), emailVerified: true });
    const hr = store.createUser({ id: 'hr-one', name: 'HR One', email: 'hr@example.com', role: 'hr', passwordHash: hashPassword('Passw0rd!'), emailVerified: true });
    const job = store.createJob({ id: 'job-one', title: 'Engineer', description: 'Role description', status: 'open' });
    store.createApplication({ id: 'app-one', jobId: job.id, userId: applicant.id, name: applicant.name, email: applicant.email, resumeFile: { provider: 's3', objectKey: 'resumes/one.pdf' } });
    store.createApplication({ id: 'app-two', jobId: job.id, userId: otherApplicant.id, name: otherApplicant.name, email: otherApplicant.email });
    store.createSession(applicant.id);
    store.createNotification({ id: 'notice-one', recipientUserId: applicant.id, subject: 'Test', sentAt: Date.now() });

    const result = store.deleteAccount(applicant.id);
    assert.deepEqual(result, { deleted: true, role: 'applicant' });
    assert.equal(store.getUserById(applicant.id), undefined);
    assert.equal(store.getApplicationById('app-one'), null);
    assert.equal(store.getApplicationById('app-two')?.userId, otherApplicant.id);
    assert.ok(store.getJobById(job.id));
    assert.equal(store.getUserById(hr.id)?.role, 'hr');
    assert.equal(store.getUserBySessionToken('invalid-token'), null);
    assert.equal(store.getNotificationsForUser(applicant).length, 0);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('deleting an HR account preserves shared job and candidate records', () => {
  const { dataDir, store } = createIsolatedStore();
  try {
    const applicant = store.createUser({ id: 'applicant-one', name: 'Applicant One', email: 'one@example.com', role: 'applicant', passwordHash: hashPassword('Passw0rd!'), emailVerified: true });
    const hr = store.createUser({ id: 'hr-one', name: 'HR One', email: 'hr@example.com', role: 'hr', passwordHash: hashPassword('Passw0rd!'), emailVerified: true });
    const job = store.createJob({ id: 'job-one', title: 'Engineer', description: 'Role description', status: 'open' });
    store.createApplication({ id: 'app-one', jobId: job.id, userId: applicant.id, name: applicant.name, email: applicant.email, resumeFile: { provider: 's3', objectKey: 'resumes/one.pdf' } });

    const result = store.deleteAccount(hr.id);
    assert.deepEqual(result, { deleted: true, role: 'hr' });
    assert.equal(store.getUserById(hr.id), undefined);
    assert.ok(store.getJobById(job.id));
    assert.ok(store.getApplicationById('app-one'));
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
