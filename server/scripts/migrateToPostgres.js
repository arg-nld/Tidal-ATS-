
import 'dotenv/config';
import fs from 'node:fs/promises';
import pg from 'pg';
import {
  SCHEMA_SQL
} from '../services/postgresStore.js';
import {
  hashPassword,
  isPasswordHash
} from '../services/passwordService.js';

const { Pool } = pg;
const dbFile = new URL('../data/db.json', import.meta.url);

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function timestamp(value, fallback = Date.now()) {
  if (!hasValue(value)) return fallback;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim() !== '') {
      return Math.trunc(numeric);
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function json(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

function addIssue(issues, record, message) {
  issues.push(`${record}: ${message}`);
}

function checkUnique(items, getKey, label, issues) {
  const seen = new Map();

  for (const item of items) {
    const key = getKey(item);
    if (!hasValue(key)) continue;

    const normalized = String(key).trim().toLowerCase();

    if (seen.has(normalized)) {
      addIssue(
        issues,
        label,
        `duplicate value "${key}" (records "${seen.get(normalized)}" and "${item.id ?? '(missing id)'}")`
      );
    } else {
      seen.set(normalized, item.id ?? '(missing id)');
    }
  }
}

function validateTimestamp(value, label, issues) {
  if (timestamp(value) === null) {
    addIssue(issues, label, 'invalid timestamp');
  }
}

async function prepareAndValidate(source) {
  const issues = [];

  const warnings = [];
  for (const key of [
    'users',
    'jobs',
    'applications',
    'notifications',
    'emailLogs',
    'emailQueue',
    'sessions'
  ]) {
    if (source[key] !== undefined && !Array.isArray(source[key])) {
      addIssue(issues, 'db.json', `"${key}" must be an array`);
      source[key] = [];
    }
  }

  source.users = asArray(source.users);
  source.jobs = asArray(source.jobs);
  source.applications = asArray(source.applications);
  source.notifications = asArray(source.notifications);
  source.emailLogs = asArray(source.emailLogs);
  source.emailQueue = asArray(source.emailQueue);
  source.sessions = asArray(source.sessions);

  const userIds = new Set();
  const jobIds = new Set();
  const applicationIds = new Set();
  const seenUserJobPairs = new Map();

  checkUnique(source.users, u => u.email, 'users.email', issues);
  checkUnique(source.users, u => u.id, 'users.id', issues);
  checkUnique(source.jobs, j => j.id, 'jobs.id', issues);
  checkUnique(source.applications, a => a.id, 'applications.id', issues);
  checkUnique(source.notifications, n => n.id, 'notifications.id', issues);
  checkUnique(source.emailLogs, l => l.id, 'emailLogs.id', issues);
  checkUnique(source.emailLogs, l => l.idempotencyKey, 'emailLogs.idempotencyKey', issues);
  checkUnique(source.emailQueue, q => q.id, 'emailQueue.id', issues);
  checkUnique(source.sessions, s => s.id, 'sessions.id', issues);

  // Keep at most one queue entry per email log, matching the database uniqueness rule.
  const queueLogIds = new Set();
  source.emailQueue = source.emailQueue.filter((q, index) => {
    if (!q.emailLogId) return true;
    const key = String(q.emailLogId);
    if (!queueLogIds.has(key)) {
      queueLogIds.add(key);
      return true;
    }
    warnings.push(`emailQueue[${index}] (${q.id ?? 'missing id'}): duplicate emailLogId "${q.emailLogId}"; omitted duplicate queue entry.`);
    return false;
  });

  for (const [index, u] of source.users.entries()) {
    const label = `users[${index}] (${u.id ?? 'missing id'})`;

    if (!hasValue(u.id)) addIssue(issues, label, 'missing id');
    else userIds.add(String(u.id));

    if (!hasValue(u.name)) addIssue(issues, label, 'missing name');
    if (!hasValue(u.email)) addIssue(issues, label, 'missing email');

    if (!['hr', 'applicant'].includes(u.role)) {
      addIssue(issues, label, `invalid role "${u.role ?? ''}"; expected "hr" or "applicant"`);
    }

    const existingHash = u.passwordHash ?? u.password_hash;

    if (hasValue(existingHash) && isPasswordHash(existingHash)) {
      u.passwordHash = existingHash;
      delete u.password_hash;
    } else if (typeof u.password === 'string' && u.password.length > 0) {
      try {
        u.passwordHash = await hashPassword(u.password);
        delete u.password;
        delete u.password_hash;
      } catch (error) {
        addIssue(issues, label, `could not hash legacy password: ${error.message}`);
      }
    } else {
      addIssue(
        issues,
        label,
        'missing valid password hash and recoverable plaintext password; resolve this account credential before migrating'
      );
    }

    validateTimestamp(u.createdAt, `${label}.createdAt`, issues);
  }

  for (const [index, j] of source.jobs.entries()) {
    const label = `jobs[${index}] (${j.id ?? 'missing id'})`;

    if (!hasValue(j.id)) addIssue(issues, label, 'missing id');
    else jobIds.add(String(j.id));

    if (!hasValue(j.title)) addIssue(issues, label, 'missing title');
    validateTimestamp(j.createdAt, `${label}.createdAt`, issues);
    validateTimestamp(j.updatedAt, `${label}.updatedAt`, issues);
  }

  for (const [index, a] of source.applications.entries()) {
    const label = `applications[${index}] (${a.id ?? 'missing id'})`;

    if (!hasValue(a.id)) addIssue(issues, label, 'missing id');
    else applicationIds.add(String(a.id));

    if (!hasValue(a.jobId)) {
      addIssue(issues, label, 'missing jobId');
    } else if (!jobIds.has(String(a.jobId))) {
      addIssue(issues, label, `jobId "${a.jobId}" does not exist in jobs`);
    }

    if (a.userId && !userIds.has(String(a.userId))) {
      warnings.push(`${label}: linked user "${a.userId}" is missing; preserving the application as an unlinked candidate record.`);
      a.userId = null;
    }

    if (a.userId && hasValue(a.jobId)) {
      const pairKey = `${a.userId}::${a.jobId}`.toLowerCase();
      if (seenUserJobPairs.has(pairKey)) {
        addIssue(
          issues,
          label,
          `duplicate application for user/job pair; the same pair already appears in application "${seenUserJobPairs.get(pairKey)}"`
        );
      } else {
        seenUserJobPairs.set(pairKey, a.id ?? '(missing id)');
      }
    }

    if (!hasValue(a.name)) addIssue(issues, label, 'missing candidate name');
    if (!hasValue(a.email)) addIssue(issues, label, 'missing candidate email');

    validateTimestamp(a.createdAt, `${label}.createdAt`, issues);
    validateTimestamp(a.updatedAt, `${label}.updatedAt`, issues);

    if (a.resumeFile) {
      const key = a.resumeFile.objectKey || a.resumeFile.storedName;
      if (!hasValue(key)) {
        addIssue(issues, label, 'resumeFile exists but has no objectKey or storedName');
      }
    }

    if (a.interview?.scheduledAt != null &&
        timestamp(a.interview.scheduledAt) === null) {
      addIssue(issues, label, 'interview has an invalid scheduledAt timestamp');
    }
  }

  const notificationsBeforeCleanup = source.notifications.length;
  source.notifications = source.notifications.filter((n, index) => {
    const label = `notifications[${index}] (${n.id ?? 'missing id'})`;
    if (!hasValue(n.id)) addIssue(issues, label, 'missing id');

    if (!hasValue(n.recipientUserId) || !userIds.has(String(n.recipientUserId))) {
      warnings.push(`${label}: omitted because its recipient account is missing.`);
      return false;
    }

    if (n.applicationId && !applicationIds.has(String(n.applicationId))) {
      warnings.push(`${label}: applicationId "${n.applicationId}" is missing; setting applicationId to null.`);
      n.applicationId = null;
    }
    if (n.jobId && !jobIds.has(String(n.jobId))) {
      warnings.push(`${label}: jobId "${n.jobId}" is missing; setting jobId to null.`);
      n.jobId = null;
    }
    validateTimestamp(n.sentAt, `${label}.sentAt`, issues);
    return true;
  });
  if (notificationsBeforeCleanup !== source.notifications.length) {
    warnings.push(`Omitted ${notificationsBeforeCleanup - source.notifications.length} notification(s) belonging to missing/deleted accounts.`);
  }

  const emailLogIds = new Set(source.emailLogs.map(log => String(log.id)));
  for (const [index, q] of source.emailQueue.entries()) {
    const label = `emailQueue[${index}] (${q.id ?? 'missing id'})`;
    if (!hasValue(q.id)) addIssue(issues, label, 'missing id');
    if (!q.payload || typeof q.payload !== 'object' || Array.isArray(q.payload)) {
      addIssue(issues, label, 'payload must be a JSON object');
    }
    if (q.emailLogId && !emailLogIds.has(String(q.emailLogId))) {
      warnings.push(`${label}: emailLogId "${q.emailLogId}" is missing; setting emailLogId to null.`);
      q.emailLogId = null;
    }
    validateTimestamp(q.availableAt, `${label}.availableAt`, issues);
    validateTimestamp(q.createdAt, `${label}.createdAt`, issues);
    if (q.lockedAt != null) validateTimestamp(q.lockedAt, `${label}.lockedAt`, issues);
    if (q.status === 'processing') {
      warnings.push(`${label}: imported processing job reset to pending because its original worker is not guaranteed to remain active.`);
      q.status = 'pending';
      q.lockedAt = null;
    }
  }

  for (const [index, s] of source.sessions.entries()) {
    const label = `sessions[${index}] (${s.id ?? 'missing id'})`;

    if (!hasValue(s.id)) addIssue(issues, label, 'missing id');
    if (!hasValue(s.userId) || !userIds.has(String(s.userId))) {
      warnings.push(`${label}: omitted because its user account is missing.`);
      s.__skipMigration = true;
    }
    if (!hasValue(s.tokenHash)) addIssue(issues, label, 'missing tokenHash');

    validateTimestamp(s.createdAt, `${label}.createdAt`, issues);
    validateTimestamp(s.expiresAt, `${label}.expiresAt`, issues);
  }

  for (const [index, l] of source.emailLogs.entries()) {
    const label = `emailLogs[${index}] (${l.id ?? 'missing id'})`;

    if (!hasValue(l.id)) addIssue(issues, label, 'missing id');
    validateTimestamp(l.createdAt, `${label}.createdAt`, issues);
    validateTimestamp(l.updatedAt, `${label}.updatedAt`, issues);
  }

  if (issues.length) {
    console.error('\nMigration preflight failed. No PostgreSQL changes were made.');
    console.error(`Found ${issues.length} issue(s):\n`);
    for (const issue of issues) console.error(`- ${issue}`);
    throw new Error('Fix the preflight issues and rerun the migration.');
  }

  source.sessions = source.sessions.filter(session => !session.__skipMigration);
  for (const session of source.sessions) delete session.__skipMigration;
  source.migrationWarnings = warnings;
  return source;
}

function metadataForUser(u) {
  const excluded = new Set([
    'id', 'createdAt', 'name', 'email', 'password',
    'passwordHash', 'password_hash', 'role', 'title',
    'company', 'phone', 'emailVerified'
  ]);

  return Object.fromEntries(
    Object.entries(u).filter(([key]) => !excluded.has(key))
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required. Set it in .env before running npm run migrate:postgres.'
    );
  }

  const raw = await fs.readFile(dbFile, 'utf8');
  let source;

  try {
    source = JSON.parse(raw);
  } catch {
    throw new Error('server/data/db.json is not valid JSON. Restore or repair it before migrating.');
  }

  source = await prepareAndValidate(source);
  if (source.migrationWarnings?.length) {
    console.warn(`\nMigration preflight produced ${source.migrationWarnings.length} warning(s):`);
    for (const warning of source.migrationWarnings) console.warn(`- ${warning}`);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PG_SSL === 'true'
      ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : undefined
  });

  let client;

  try {
    client = await pool.connect();

    // Both schema creation and imported data are inside this transaction.
    await client.query('BEGIN');
    await client.query(SCHEMA_SQL);

    for (const u of source.users) {
      await client.query(
        `INSERT INTO users
          (id, created_at, name, email, password_hash, role, title, company,
           phone, email_verified, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name, email=EXCLUDED.email,
           password_hash=EXCLUDED.password_hash, role=EXCLUDED.role,
           title=EXCLUDED.title, company=EXCLUDED.company,
           phone=EXCLUDED.phone, email_verified=EXCLUDED.email_verified,
           metadata=EXCLUDED.metadata`,
        [
          u.id,
          timestamp(u.createdAt),
          u.name,
          u.email,
          u.passwordHash,
          u.role,
          u.title || '',
          u.company || '',
          u.phone || '',
          u.emailVerified !== false,
          json(metadataForUser(u), {})
        ]
      );
    }

    for (const j of source.jobs) {
      await client.query(
        `INSERT INTO jobs
          (id,title,department,location,type,experience_level,salary_range,
           status,description,scoring_weights,required_skills,non_required_skills,
           created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO UPDATE SET
           title=EXCLUDED.title, department=EXCLUDED.department,
           location=EXCLUDED.location, type=EXCLUDED.type,
           experience_level=EXCLUDED.experience_level,
           salary_range=EXCLUDED.salary_range, status=EXCLUDED.status,
           description=EXCLUDED.description,
           scoring_weights=EXCLUDED.scoring_weights,
           required_skills=EXCLUDED.required_skills,
           non_required_skills=EXCLUDED.non_required_skills,
           updated_at=EXCLUDED.updated_at`,
        [
          j.id, j.title, j.department || '', j.location || '',
          j.type || '', j.experienceLevel || '', j.salaryRange || '',
          j.status || 'open', j.description || '',
          json(j.scoringWeights, {}),
          json(j.requiredSkills, []),
          json(j.nonRequiredSkills, []),
          timestamp(j.createdAt),
          timestamp(j.updatedAt)
        ]
      );
    }

    for (const a of source.applications) {
      const metadata = {};
      for (const key of [
        'geminiScore', 'geminiRationale', 'isScreening', 'geminiError',
        'screeningBreakdown', 'screeningWeights',
        'screeningMatchedRequiredSkills', 'screeningMissingRequiredSkills',
        'screeningMatchedNonRequiredSkills', 'screeningMissingNonRequiredSkills',
        'candidateExperienceYears', 'requiredExperienceYears', 'screeningVersion'
      ]) {
        metadata[key] = a[key] ?? null;
      }

      await client.query(
        `INSERT INTO applications
          (id,job_id,user_id,name,email,phone,role,skills,experience_summary,
           resume_text,file_name,file_size,stage,recruiter_notes,created_at,
           updated_at,metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         ON CONFLICT (id) DO UPDATE SET
           job_id=EXCLUDED.job_id, user_id=EXCLUDED.user_id,
           name=EXCLUDED.name, email=EXCLUDED.email, phone=EXCLUDED.phone,
           role=EXCLUDED.role, skills=EXCLUDED.skills,
           experience_summary=EXCLUDED.experience_summary,
           resume_text=EXCLUDED.resume_text, file_name=EXCLUDED.file_name,
           file_size=EXCLUDED.file_size, stage=EXCLUDED.stage,
           recruiter_notes=EXCLUDED.recruiter_notes,
           updated_at=EXCLUDED.updated_at, metadata=EXCLUDED.metadata`,
        [
          a.id, a.jobId, a.userId || null, a.name, a.email,
          a.phone || '', a.role || '', json(a.skills, []),
          a.experienceSummary || '', a.resumeText || '',
          a.fileName || '', Number(a.fileSize || 0),
          a.stage || 'Application Submitted', a.recruiterNotes || '',
          timestamp(a.createdAt), timestamp(a.updatedAt), json(metadata, {})
        ]
      );

      if (a.resumeFile) {
        await client.query(
          `INSERT INTO resumes
            (application_id,provider,object_key,original_name,mime_type,size,uploaded_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (application_id) DO UPDATE SET
             provider=EXCLUDED.provider, object_key=EXCLUDED.object_key,
             original_name=EXCLUDED.original_name, mime_type=EXCLUDED.mime_type,
             size=EXCLUDED.size, uploaded_at=EXCLUDED.uploaded_at`,
          [
            a.id, a.resumeFile.provider || 'local',
            a.resumeFile.objectKey || a.resumeFile.storedName,
            a.resumeFile.originalName || '', a.resumeFile.mimeType || '',
            Number(a.resumeFile.size || 0),
            timestamp(a.resumeFile.uploadedAt)
          ]
        );
      }

      if (a.interview) {
        await client.query(
          `INSERT INTO interviews
            (application_id,scheduled_at,interviewer,type,meeting_link,notes,
             email_subject,email_body,attachments,scheduled_by,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (application_id) DO UPDATE SET
             scheduled_at=EXCLUDED.scheduled_at, interviewer=EXCLUDED.interviewer,
             type=EXCLUDED.type, meeting_link=EXCLUDED.meeting_link,
             notes=EXCLUDED.notes, email_subject=EXCLUDED.email_subject,
             email_body=EXCLUDED.email_body, attachments=EXCLUDED.attachments,
             scheduled_by=EXCLUDED.scheduled_by, created_at=EXCLUDED.created_at`,
          [
            a.id, a.interview.scheduledAt == null
              ? null
              : new Date(a.interview.scheduledAt).toISOString(),
            a.interview.interviewer || '', a.interview.type || 'Interview',
            a.interview.meetingLink || '', a.interview.notes || '',
            a.interview.emailSubject || '', a.interview.emailBody || '',
            json(a.interview.attachments, []),
            a.interview.scheduledBy || '',
            timestamp(a.interview.createdAt)
          ]
        );
      }

      if (a.evaluation) {
        await client.query(
          `INSERT INTO evaluations
            (application_id,rating,recommendation,comments,evaluated_by,evaluated_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (application_id) DO UPDATE SET
             rating=EXCLUDED.rating, recommendation=EXCLUDED.recommendation,
             comments=EXCLUDED.comments, evaluated_by=EXCLUDED.evaluated_by,
             evaluated_at=EXCLUDED.evaluated_at`,
          [
            a.id, a.evaluation.rating,
            a.evaluation.recommendation || 'Consider',
            a.evaluation.comments || '', a.evaluation.evaluatedBy || '',
            timestamp(a.evaluation.evaluatedAt)
          ]
        );
      }
    }

    for (const n of source.notifications) {
      await client.query(
        `INSERT INTO notifications
          (id,application_id,recipient_user_id,job_id,recipient_email,
           recipient_name,stage,subject,body,delivery_status,delivery_error,
           provider_message_id,email_type,sent_at,read)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO UPDATE SET
           read=EXCLUDED.read, delivery_status=EXCLUDED.delivery_status,
           delivery_error=EXCLUDED.delivery_error`,
        [
          n.id, n.applicationId || null, n.recipientUserId, n.jobId || null,
          n.recipientEmail ?? null, n.recipientName ?? null,
          n.stage ?? null, n.subject ?? null, n.body ?? null,
          n.deliveryStatus || 'sent', n.deliveryError || null,
          n.providerMessageId || null, n.emailType || 'notification',
          timestamp(n.sentAt), !!n.read
        ]
      );
    }

    for (const l of source.emailLogs) {
      await client.query(
        `INSERT INTO email_logs
          (id,idempotency_key,to_addresses,subject,type,status,attempts,
           provider_message_id,error,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING`,
        [
          l.id, l.idempotencyKey || null, json(l.to, []),
          l.subject || '', l.type || 'transactional',
          l.status || 'pending', Number(l.attempts || 0),
          l.providerMessageId || null, l.error || null,
          timestamp(l.createdAt), timestamp(l.updatedAt)
        ]
      );
    }

    for (const q of source.emailQueue) {
      await client.query(
        `INSERT INTO email_queue
          (id,email_log_id,payload,status,attempts,available_at,locked_at,last_error,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET
           email_log_id=EXCLUDED.email_log_id, payload=EXCLUDED.payload,
           status=EXCLUDED.status, attempts=EXCLUDED.attempts,
           available_at=EXCLUDED.available_at, locked_at=EXCLUDED.locked_at,
           last_error=EXCLUDED.last_error`,
        [q.id, q.emailLogId || null, json(q.payload, {}), q.status || 'pending',
          Number(q.attempts || 0), timestamp(q.availableAt),
          q.lockedAt == null ? null : timestamp(q.lockedAt), q.lastError || null,
          timestamp(q.createdAt)]
      );
    }

    for (const s of source.sessions) {
      await client.query(
        `INSERT INTO sessions (id,user_id,token_hash,created_at,expires_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO NOTHING`,
        [
          s.id, s.userId, s.tokenHash,
          timestamp(s.createdAt), timestamp(s.expiresAt)
        ]
      );
    }

    await client.query('COMMIT');

    console.log('PostgreSQL migration completed successfully.');
    console.log(`Users: ${source.users.length}`);
    console.log(`Jobs: ${source.jobs.length}`);
    console.log(`Applications: ${source.applications.length}`);
    console.log(`Notifications: ${source.notifications.length}`);
    console.log(`Email logs: ${source.emailLogs.length}`);
    console.log(`Email queue entries: ${source.emailQueue.length}`);
    console.log(`Sessions: ${source.sessions.length}`);
    if (source.migrationWarnings?.length) {
      console.log(`Warnings handled automatically: ${source.migrationWarnings.length}`);
    }
    console.log('Note: resume files themselves were not copied; only their metadata was migrated.');
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original migration error.
      }
    }

    console.error('\nPostgreSQL migration failed.');
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});