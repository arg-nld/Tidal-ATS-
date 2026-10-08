import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../services/store.js';

function createTestStore() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tidal-ats-notifications-'));
  const store = new Store({ dataDir, backupIntervalMs: 60_000 });
  return { store, dataDir };
}

test('notification mutations are scoped to the notification recipient', () => {
  const { store, dataDir } = createTestStore();

  try {
    store.data.notifications = [];
    const hr = { id: 'hr-a', role: 'hr', email: 'hr-a@example.com' };
    const otherHr = { id: 'hr-b', role: 'hr', email: 'hr-b@example.com' };
    const candidate = { id: 'candidate-a', role: 'applicant', email: 'candidate-a@example.com' };

    const hrNotification = store.createNotification({
      recipientUserId: hr.id,
      recipientEmail: hr.email,
      recipientName: 'HR A',
      subject: 'HR notification',
      body: 'HR only',
      sentAt: Date.now()
    });

    const candidateNotification = store.createNotification({
      recipientUserId: candidate.id,
      recipientEmail: candidate.email,
      recipientName: 'Candidate A',
      subject: 'Candidate notification',
      body: 'Candidate only',
      sentAt: Date.now()
    });

    assert.equal(store.getNotificationsForUser(hr).length, 1);
    assert.equal(store.getNotificationsForUser(otherHr).length, 0);
    assert.equal(store.getNotificationsForUser(candidate).length, 1);

    assert.equal(store.deleteNotificationForUser(hrNotification.id, otherHr), null);
    assert.equal(store.deleteNotificationForUser(hrNotification.id, hr)?.id, hrNotification.id);
    assert.equal(store.getNotificationsForUser(hr).length, 0);
    assert.equal(store.getNotificationsForUser(candidate).length, 1);

    assert.equal(store.clearNotificationsForUser(otherHr), 0);
    assert.equal(store.clearNotificationsForUser(candidate), 1);
    assert.equal(store.getNotificationsForUser(candidate).length, 0);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('marking a notification as read is idempotent', () => {
  const { store, dataDir } = createTestStore();

  try {
    store.data.notifications = [];
    const user = { id: 'candidate-b', role: 'applicant', email: 'candidate-b@example.com' };

    const notification = store.createNotification({
      recipientUserId: user.id,
      recipientEmail: user.email,
      recipientName: 'Candidate B',
      subject: 'Read test',
      body: 'Test',
      sentAt: Date.now()
    });

    assert.equal(notification.read, false);
    assert.equal(store.markNotificationAsRead(notification.id).read, true);
    assert.equal(store.markNotificationAsRead(notification.id).read, true);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});


test('HR application notifications are created for each HR account', async () => {
  const { store, dataDir } = createTestStore();

  try {
    const hr = { id: 'hr-a', role: 'hr', email: 'hr-a@example.com', name: 'HR A' };
    const candidate = { id: 'candidate-a', email: 'candidate-a@example.com', name: 'Candidate A', jobId: 'job-a', role: 'Engineer' };
    store.data.users = [hr];
    store.data.notifications = [];
    store.data.applications = [];
    store.data.jobs = [{ id: 'job-a', title: 'Engineer' }];

    const { createHrApplicationNotification } = await import('../services/emailService.js');
    const created = createHrApplicationNotification({ applicant: candidate, job: store.data.jobs[0], notificationStore: store });

    assert.equal(created.length, 1);
    assert.equal(created[0].recipientUserId, hr.id);
    assert.equal(store.getNotificationsForUser(hr).length, 1);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
