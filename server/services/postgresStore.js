import pg from 'pg';
import crypto from 'node:crypto';
import { hashPassword, isPasswordHash, verifyPassword } from './passwordService.js';

const { Pool } = pg;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at BIGINT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('hr','applicant')),
  title TEXT,
  company TEXT,
  phone TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique ON users(lower(email));

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  department TEXT,
  location TEXT,
  type TEXT,
  experience_level TEXT,
  salary_range TEXT,
  status TEXT,
  description TEXT NOT NULL DEFAULT '',
  scoring_weights JSONB NOT NULL DEFAULT '{"requiredSkills":70,"nonRequiredSkills":20,"experience":10}'::jsonb,
  required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  non_required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience_summary TEXT,
  resume_text TEXT,
  file_name TEXT,
  file_size BIGINT DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'Application Submitted',
  recruiter_notes TEXT DEFAULT '',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_applications_job_created ON applications(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_user_created ON applications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_stage ON applications(stage);
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_unique_user_job
  ON applications(user_id, job_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS resumes (
  application_id TEXT PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'local',
  object_key TEXT,
  original_name TEXT,
  mime_type TEXT,
  size BIGINT DEFAULT 0,
  uploaded_at BIGINT
);

CREATE TABLE IF NOT EXISTS screening_results (
  application_id TEXT PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  score NUMERIC,
  rationale TEXT,
  is_screening BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT,
  breakdown JSONB,
  weights JSONB,
  matched_required_skills JSONB,
  missing_required_skills JSONB,
  matched_non_required_skills JSONB,
  missing_non_required_skills JSONB,
  candidate_experience_years NUMERIC,
  required_experience_years NUMERIC,
  version INTEGER
);

CREATE TABLE IF NOT EXISTS interviews (
  application_id TEXT PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  scheduled_at TEXT,
  interviewer TEXT,
  type TEXT,
  meeting_link TEXT,
  notes TEXT,
  email_subject TEXT,
  email_body TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  scheduled_by TEXT,
  created_at BIGINT
);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at ON interviews(scheduled_at);

CREATE TABLE IF NOT EXISTS evaluations (
  application_id TEXT PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  rating NUMERIC,
  recommendation TEXT,
  comments TEXT,
  evaluated_by TEXT,
  evaluated_at BIGINT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  application_id TEXT REFERENCES applications(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
  recipient_email TEXT,
  recipient_name TEXT,
  stage TEXT,
  subject TEXT,
  body TEXT,
  delivery_status TEXT,
  delivery_error TEXT,
  provider_message_id TEXT,
  email_type TEXT,
  sent_at BIGINT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_sent ON notifications(recipient_user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_user_id, read, sent_at DESC);

CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT,
  to_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT,
  type TEXT,
  status TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  error TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_logs_idempotency ON email_logs(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_queue (
  id TEXT PRIMARY KEY,
  email_log_id TEXT REFERENCES email_logs(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at BIGINT NOT NULL,
  locked_at BIGINT,
  last_error TEXT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_queue_ready ON email_queue(status, available_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_queue_email_log_unique ON email_queue(email_log_id) WHERE email_log_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS recruiter_notes (
  id BIGSERIAL PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_recruiter_notes_application ON recruiter_notes(application_id, created_at DESC);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scorecard_criteria JSONB DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rating_scale INTEGER DEFAULT 5;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sourcing_cost NUMERIC DEFAULT 0;

ALTER TABLE applications ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Direct Application';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS scorecards JSONB DEFAULT '[]'::jsonb;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS offer JSONB DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS merged_into TEXT DEFAULT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS merged_applications JSONB DEFAULT '[]'::jsonb;
`;

function json(v, fallback) {
  return v == null ? fallback : v;
}

function mapJob(r) {
  if (!r) return null;
  return {
    id: r.id, title: r.title, department: r.department || '', location: r.location || '',
    type: r.type || '', experienceLevel: r.experience_level || '', salaryRange: r.salary_range || '',
    status: r.status || 'open', description: r.description || '',
    scoringWeights: json(r.scoring_weights, { requiredSkills: 70, nonRequiredSkills: 20, experience: 10 }),
    requiredSkills: json(r.required_skills, []), nonRequiredSkills: json(r.non_required_skills, []),
    scorecardCriteria: json(r.scorecard_criteria, []),
    ratingScale: Number(r.rating_scale || 5),
    sourcingCost: Number(r.sourcing_cost || 0),
    createdAt: Number(r.created_at), updatedAt: Number(r.updated_at)
  };
}

function mapUser(r) {
  if (!r) return null;
  return {
    id: r.id, createdAt: Number(r.created_at), name: r.name, email: r.email,
    passwordHash: r.password_hash, role: r.role, title: r.title || '', company: r.company || '',
    phone: r.phone || '', emailVerified: !!r.email_verified, ...(r.metadata || {})
  };
}

function mapApplication(r) {
  if (!r) return null;
  const metadata = r.metadata || {};
  const scorecards = json(r.scorecards, metadata.scorecards || []);
  const timeline = json(r.timeline, metadata.timeline || []);
  const offer = json(r.offer, metadata.offer || null);
  const source = r.source || metadata.source || 'Direct Application';
  const mergedInto = r.merged_into || metadata.mergedInto || null;
  const mergedApplications = json(r.merged_applications, metadata.mergedApplications || []);

  const app = {
    id: r.id, jobId: r.job_id, userId: r.user_id, name: r.name, email: r.email, phone: r.phone || '',
    role: r.role || '', skills: json(r.skills, []), experienceSummary: r.experience_summary || '',
    resumeText: r.resume_text || '', fileName: r.file_name || '', fileSize: Number(r.file_size || 0),
    stage: r.stage, recruiterNotes: r.recruiter_notes || '', createdAt: Number(r.created_at), updatedAt: Number(r.updated_at),
    source,
    scorecards,
    timeline,
    offer,
    mergedInto,
    mergedApplications,
    geminiScore: metadata.geminiScore ?? null, geminiRationale: metadata.geminiRationale ?? null,
    isScreening: metadata.isScreening ?? false, geminiError: metadata.geminiError ?? null,
    screeningBreakdown: metadata.screeningBreakdown ?? null, screeningWeights: metadata.screeningWeights ?? null,
    screeningMatchedRequiredSkills: metadata.screeningMatchedRequiredSkills ?? null,
    screeningMissingRequiredSkills: metadata.screeningMissingRequiredSkills ?? null,
    screeningMatchedNonRequiredSkills: metadata.screeningMatchedNonRequiredSkills ?? null,
    screeningMissingNonRequiredSkills: metadata.screeningMissingNonRequiredSkills ?? null,
    candidateExperienceYears: metadata.candidateExperienceYears ?? null,
    requiredExperienceYears: metadata.requiredExperienceYears ?? null,
    screeningVersion: metadata.screeningVersion ?? null,
    interview: r.interview_scheduled_at ? {
      scheduledAt: r.interview_scheduled_at, interviewer: r.interviewer || '', type: r.interview_type || 'Interview',
      meetingLink: r.meeting_link || '', notes: r.interview_notes || '', emailSubject: r.email_subject || '',
      emailBody: r.email_body || '', attachments: json(r.interview_attachments, []),
      scheduledBy: r.scheduled_by || '', createdAt: r.interview_created_at ? Number(r.interview_created_at) : null
    } : null,
    evaluation: r.evaluation_rating != null ? {
      rating: Number(r.evaluation_rating), recommendation: r.evaluation_recommendation || 'Consider',
      comments: r.evaluation_comments || '', evaluatedBy: r.evaluated_by || '', evaluatedAt: r.evaluated_at ? Number(r.evaluated_at) : null
    } : null,
    resumeFile: r.resume_object_key ? {
      provider: r.resume_provider || 'local', storedName: r.resume_object_key, objectKey: r.resume_object_key,
      originalName: r.resume_original_name || '', mimeType: r.resume_mime_type || 'application/octet-stream',
      size: Number(r.resume_size || 0), uploadedAt: r.resume_uploaded_at ? Number(r.resume_uploaded_at) : null
    } : null
  };
  return app;
}

export class PostgresStore {
  constructor({ connectionString = process.env.DATABASE_URL } = {}) {
    if (!connectionString) throw new Error('DATABASE_URL is required when PostgreSQL storage is enabled.');
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX || 10),
      ssl: process.env.PG_SSL === 'true'
        ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : undefined
    });
    this.readyPromise = this.pool.query(SCHEMA_SQL);
  }

  async ready() { await this.readyPromise; }

  async close() { await this.pool.end(); }

  async getUsers() {
    await this.ready();
    const { rows } = await this.pool.query('SELECT * FROM users ORDER BY created_at ASC');
    return rows.map(mapUser);
  }
  async getUserById(id) {
    await this.ready();
    const { rows } = await this.pool.query('SELECT * FROM users WHERE id=$1', [id]);
    return mapUser(rows[0]);
  }
  async getUserByEmail(email) {
    await this.ready();
    const { rows } = await this.pool.query('SELECT * FROM users WHERE lower(email)=lower($1) LIMIT 1', [String(email || '').trim()]);
    return mapUser(rows[0]);
  }
  async getUserByEmailAndPassword(email, password) {
    const user = await this.getUserByEmail(email);
    return user && verifyPassword(password, user.passwordHash) ? user : null;
  }
  async createUser(data) {
    await this.ready();
    const user = {
      id: data.id || `user-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      createdAt: Date.now(), emailVerified: data.emailVerified ?? false, ...data
    };
    if (typeof user.password === 'string' && user.password.length > 0) {
      user.passwordHash = hashPassword(user.password);
    }
    if (!isPasswordHash(user.passwordHash)) {
      throw new Error('A valid password or recognized passwordHash is required to create a user.');
    }
    const passwordHash = user.passwordHash;
    const { rows } = await this.pool.query(
      `INSERT INTO users(id,created_at,name,email,password_hash,role,title,company,phone,email_verified,metadata)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [user.id,user.createdAt,user.name,user.email,passwordHash,user.role,user.title||'',user.company||'',user.phone||'',!!user.emailVerified,
       JSON.stringify(Object.fromEntries(Object.entries(user).filter(([k]) => !['id','createdAt','name','email','password','passwordHash','role','title','company','phone','emailVerified'].includes(k))))]
    );
    return mapUser(rows[0]);
  }
  async updateUser(id, updates) {
    const existing = await this.getUserById(id); if (!existing) return null;
    const merged = {...existing, ...updates};
    const passwordHash = updates.password ? hashPassword(updates.password) : (updates.passwordHash ? (isPasswordHash(updates.passwordHash) ? updates.passwordHash : hashPassword(updates.passwordHash)) : existing.passwordHash);
    const base = ['id','createdAt','name','email','role','title','company','phone','emailVerified','passwordHash'];
    const metadata = Object.fromEntries(Object.entries(merged).filter(([k]) => !base.includes(k) && k !== 'password'));
    const { rows } = await this.pool.query(
      `UPDATE users SET name=$2,email=$3,password_hash=$4,role=$5,title=$6,company=$7,phone=$8,email_verified=$9,metadata=$10 WHERE id=$1 RETURNING *`,
      [id,merged.name,merged.email,passwordHash,merged.role,merged.title||'',merged.company||'',merged.phone||'',!!merged.emailVerified,JSON.stringify(metadata)]
    );
    return mapUser(rows[0]);
  }
  async deleteUser(id) { await this.ready(); const r=await this.pool.query('DELETE FROM users WHERE id=$1',[id]); return r.rowCount>0; }
  async getUsersByRole(role) { await this.ready(); const {rows}=await this.pool.query('SELECT * FROM users WHERE role=$1 ORDER BY created_at ASC',[role]); return rows.map(mapUser); }

  async createSession(userId, ttlMs=12*60*60*1000) {
    await this.ready(); const token=crypto.randomBytes(32).toString('hex'); const tokenHash=crypto.createHash('sha256').update(token).digest('hex'); const now=Date.now();
    await this.pool.query('DELETE FROM sessions WHERE expires_at <= $1',[now]);
    await this.pool.query('INSERT INTO sessions(id,user_id,token_hash,created_at,expires_at) VALUES($1,$2,$3,$4,$5)',[crypto.randomBytes(16).toString('hex'),userId,tokenHash,now,now+ttlMs]);
    return token;
  }
  async getUserBySessionToken(token) {
    await this.ready(); if (!token) return null;
    const hash=crypto.createHash('sha256').update(String(token)).digest('hex');
    const {rows}=await this.pool.query('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2',[hash,Date.now()]);
    return mapUser(rows[0]);
  }
  async deleteSession(token) {
    await this.ready(); if(!token) return false; const hash=crypto.createHash('sha256').update(String(token)).digest('hex');
    const r=await this.pool.query('DELETE FROM sessions WHERE token_hash=$1',[hash]); return r.rowCount>0;
  }

  async getJobs() { await this.ready(); const {rows}=await this.pool.query('SELECT * FROM jobs ORDER BY created_at DESC'); return rows.map(mapJob); }
  async getJobById(id) { await this.ready(); const {rows}=await this.pool.query('SELECT * FROM jobs WHERE id=$1',[id]); return mapJob(rows[0]); }
  async createJob(d) {
    await this.ready(); const now=Date.now(); const job={id:d.id||`job-${now}-${Math.random().toString(36).slice(2,7)}`,...d,createdAt:now,updatedAt:now};
    const {rows}=await this.pool.query(`INSERT INTO jobs(id,title,department,location,type,experience_level,salary_range,status,description,scoring_weights,required_skills,non_required_skills,scorecard_criteria,rating_scale,sourcing_cost,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [job.id,job.title,job.department||'General',job.location||'Remote',job.type||'Full-time',job.experienceLevel||'',job.salaryRange||'',job.status||'open',job.description||'',
       JSON.stringify(job.scoringWeights||{requiredSkills:70,nonRequiredSkills:20,experience:10}),JSON.stringify(job.requiredSkills||[]),JSON.stringify(job.nonRequiredSkills||[]),
       JSON.stringify(job.scorecardCriteria||[]),Number(job.ratingScale||5),Number(job.sourcingCost||0),now,now]);
    return mapJob(rows[0]);
  }
  async updateJob(id, updates) {
    const old=await this.getJobById(id); if(!old) return null; const j={...old,...updates,updatedAt:Date.now()};
    const {rows}=await this.pool.query(`UPDATE jobs SET title=$2,department=$3,location=$4,type=$5,experience_level=$6,salary_range=$7,status=$8,description=$9,scoring_weights=$10,required_skills=$11,non_required_skills=$12,scorecard_criteria=$13,rating_scale=$14,sourcing_cost=$15,updated_at=$16 WHERE id=$1 RETURNING *`,
      [id,j.title,j.department||'',j.location||'',j.type||'',j.experienceLevel||'',j.salaryRange||'',j.status||'open',j.description||'',
       JSON.stringify(j.scoringWeights||{}),JSON.stringify(j.requiredSkills||[]),JSON.stringify(j.nonRequiredSkills||[]),
       JSON.stringify(j.scorecardCriteria||[]),Number(j.ratingScale||5),Number(j.sourcingCost||0),j.updatedAt]);
    return mapJob(rows[0]);
  }
  async deleteJob(id) { await this.ready(); const r=await this.pool.query('DELETE FROM jobs WHERE id=$1',[id]); return r.rowCount>0; }

  async _applicationRows(where='', params=[]) {
    await this.ready();
    const sql=`SELECT a.*, r.provider AS resume_provider,r.object_key AS resume_object_key,r.original_name AS resume_original_name,r.mime_type AS resume_mime_type,r.size AS resume_size,r.uploaded_at AS resume_uploaded_at,
      i.scheduled_at AS interview_scheduled_at,i.interviewer,i.type AS interview_type,i.meeting_link,i.notes AS interview_notes,i.email_subject,i.email_body,i.attachments AS interview_attachments,i.scheduled_by,i.created_at AS interview_created_at,
      e.rating AS evaluation_rating,e.recommendation AS evaluation_recommendation,e.comments AS evaluation_comments,e.evaluated_by,e.evaluated_at
      FROM applications a LEFT JOIN resumes r ON r.application_id=a.id LEFT JOIN interviews i ON i.application_id=a.id LEFT JOIN evaluations e ON e.application_id=a.id ${where} ORDER BY a.created_at DESC`;
    const {rows}=await this.pool.query(sql,params); return rows.map(mapApplication);
  }
  async getApplications() { return this._applicationRows(); }
  async getApplicationById(id) { const rows=await this._applicationRows('WHERE a.id=$1',[id]); return rows[0]||null; }
  async getApplicationsByUserId(id) { return this._applicationRows('WHERE a.user_id=$1',[id]); }
  async getApplicationsByJobId(id) { return this._applicationRows('WHERE a.job_id=$1',[id]); }

  async createApplication(d) {
    await this.ready(); const now=Date.now(); const id=d.id||`app-${now}-${Math.random().toString(36).slice(2,7)}`;
    const metadata={
      geminiScore:d.geminiScore??null,geminiRationale:d.geminiRationale||null,isScreening:false,geminiError:null,
      source:d.source||'Direct Application',scorecards:d.scorecards||[],timeline:d.timeline||[],offer:d.offer||null,
      mergedInto:d.mergedInto||null,mergedApplications:d.mergedApplications||[]
    };
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO applications(id,job_id,user_id,name,email,phone,role,skills,experience_summary,resume_text,file_name,file_size,stage,recruiter_notes,source,scorecards,timeline,offer,merged_into,merged_applications,created_at,updated_at,metadata)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [id,d.jobId,d.userId||null,d.name,d.email,d.phone||'',d.role||'',JSON.stringify(d.skills||[]),d.experienceSummary||'',d.resumeText||'',d.fileName||'',Number(d.fileSize||0),d.stage||'Application Submitted',d.recruiterNotes||'',
         d.source||'Direct Application',JSON.stringify(d.scorecards||[]),JSON.stringify(d.timeline||[]),d.offer ? JSON.stringify(d.offer) : null,d.mergedInto||null,JSON.stringify(d.mergedApplications||[]),now,now,JSON.stringify(metadata)]);
      if (d.resumeFile) await client.query(`INSERT INTO resumes(application_id,provider,object_key,original_name,mime_type,size,uploaded_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [id,d.resumeFile.provider||'local',d.resumeFile.objectKey||d.resumeFile.storedName,d.resumeFile.originalName||'',d.resumeFile.mimeType||'',Number(d.resumeFile.size||0),d.resumeFile.uploadedAt||now]);
      await client.query('COMMIT');
    } catch(e){ await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    return this.getApplicationById(id);
  }

  async updateApplication(id, updates) {
    const old=await this.getApplicationById(id); if(!old) return null;
    const now=Date.now();
    const metaKeys = [
      'geminiScore','geminiRationale','isScreening','geminiError','screeningBreakdown',
      'screeningWeights','screeningMatchedRequiredSkills','screeningMissingRequiredSkills',
      'screeningMatchedNonRequiredSkills','screeningMissingNonRequiredSkills',
      'candidateExperienceYears','requiredExperienceYears','screeningVersion',
      'source','scorecards','timeline','offer','mergedInto','mergedApplications'
    ];
    const meta={...Object.fromEntries(metaKeys.map(k=>[k,old[k]]))};
    for (const k of Object.keys(meta)) if(Object.prototype.hasOwnProperty.call(updates,k)) meta[k]=updates[k];
    const fields={
      name:old.name,email:old.email,phone:old.phone,role:old.role,skills:old.skills,
      experienceSummary:old.experienceSummary,resumeText:old.resumeText,fileName:old.fileName,
      fileSize:old.fileSize,stage:old.stage,recruiterNotes:old.recruiterNotes,
      source:old.source||'Direct Application',scorecards:old.scorecards||[],
      timeline:old.timeline||[],offer:old.offer||null,mergedInto:old.mergedInto||null,
      mergedApplications:old.mergedApplications||[],
      ...updates
    };
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE applications SET name=$2,email=$3,phone=$4,role=$5,skills=$6,experience_summary=$7,resume_text=$8,file_name=$9,file_size=$10,stage=$11,recruiter_notes=$12,source=$13,scorecards=$14,timeline=$15,offer=$16,merged_into=$17,merged_applications=$18,updated_at=$19,metadata=$20 WHERE id=$1`,
        [id,fields.name,fields.email,fields.phone,fields.role,JSON.stringify(fields.skills||[]),fields.experienceSummary||'',fields.resumeText||'',fields.fileName||'',Number(fields.fileSize||0),fields.stage,fields.recruiterNotes||'',
         fields.source||'Direct Application',JSON.stringify(fields.scorecards||[]),JSON.stringify(fields.timeline||[]),fields.offer ? JSON.stringify(fields.offer) : null,fields.mergedInto||null,JSON.stringify(fields.mergedApplications||[]),now,JSON.stringify(meta)]);
      if (Object.prototype.hasOwnProperty.call(updates,'interview')) {
        await client.query('DELETE FROM interviews WHERE application_id=$1',[id]);
        if (updates.interview) {
          const i=updates.interview;
          await client.query(`INSERT INTO interviews(application_id,scheduled_at,interviewer,type,meeting_link,notes,email_subject,email_body,attachments,scheduled_by,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [id,i.scheduledAt,i.interviewer,i.type||'Interview',i.meetingLink||'',i.notes||'',i.emailSubject||'',i.emailBody||'',JSON.stringify(i.attachments||[]),i.scheduledBy||'',i.createdAt||now]);
        }
      }
      if (Object.prototype.hasOwnProperty.call(updates,'evaluation')) {
        await client.query('DELETE FROM evaluations WHERE application_id=$1',[id]);
        if (updates.evaluation) { const e=updates.evaluation; await client.query(`INSERT INTO evaluations(application_id,rating,recommendation,comments,evaluated_by,evaluated_at) VALUES($1,$2,$3,$4,$5,$6)`,[id,e.rating,e.recommendation,e.comments,e.evaluatedBy,e.evaluatedAt||now]); }
      }
      await client.query('COMMIT');
    } catch(e){await client.query('ROLLBACK');throw e;} finally {client.release();}
    return this.getApplicationById(id);
  }

  async mergeApplications(primaryId, duplicateIds = [], mergedBy = 'HR Recruiter') {
    const primary = await this.getApplicationById(primaryId);
    if (!primary) return null;

    const actorName = typeof mergedBy === 'object' && mergedBy?.name ? mergedBy.name : String(mergedBy || 'HR Recruiter');
    const dupList = Array.isArray(duplicateIds) ? duplicateIds : [duplicateIds];
    const duplicates = [];
    for (const dupId of dupList) {
      if (dupId && dupId !== primaryId) {
        const dup = await this.getApplicationById(dupId);
        if (dup) duplicates.push(dup);
      }
    }

    if (duplicates.length === 0) return primary;

    const combinedNotes = [
      primary.recruiterNotes,
      ...duplicates.map(d => `[Merged from ${d.name} (${d.email})]: ${d.recruiterNotes || 'No notes'}`)
    ].filter(Boolean).join('\n\n');

    const allScorecards = [
      ...(primary.scorecards || []),
      ...duplicates.flatMap(d => d.scorecards || [])
    ];

    const allTimeline = [
      ...(primary.timeline || []),
      ...duplicates.flatMap(d => d.timeline || [])
    ];

    const mergedAppIds = Array.from(new Set([
      ...(primary.mergedApplications || []),
      ...duplicates.map(d => d.id)
    ]));

    allTimeline.push({
      id: `tle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'candidate_merged',
      title: 'Candidate Profile Merged',
      description: `Merged profiles for: ${duplicates.map(d => `${d.name} (${d.email})`).join(', ')}`,
      performedBy: actorName,
      performedByRole: 'hr',
      timestamp: Date.now(),
      metadata: { mergedApplicationIds: duplicates.map(d => d.id) }
    });

    const updatedPrimary = await this.updateApplication(primaryId, {
      recruiterNotes: combinedNotes,
      scorecards: allScorecards,
      timeline: allTimeline.sort((a, b) => a.timestamp - b.timestamp),
      mergedApplications: mergedAppIds
    });

    for (const dup of duplicates) {
      await this.updateApplication(dup.id, {
        stage: 'Archived (Duplicate Merged)',
        mergedInto: primaryId,
        recruiterNotes: `[MERGED INTO ${primary.name} (${primary.id})]\n${dup.recruiterNotes || ''}`,
        timeline: [
          ...(dup.timeline || []),
          {
            id: `tle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'candidate_merged',
            title: 'Merged into Primary Record',
            description: `Merged into primary candidate profile: ${primary.name} (${primary.email})`,
            performedBy: actorName,
            performedByRole: 'hr',
            timestamp: Date.now(),
            metadata: { primaryId }
          }
        ]
      });
    }

    return updatedPrimary;
  }

  async scheduleInterviewIfAvailable(id, interviewData, conflictWindowMs = 30 * 60 * 1000) {
    await this.ready();
    const requestedMs = new Date(interviewData?.scheduledAt).getTime();
    if (Number.isNaN(requestedMs)) {
      return { ok: false, reason: 'invalid_time', application: null };
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize interview booking attempts so two requests cannot both pass the conflict check.
      await client.query("SELECT pg_advisory_xact_lock(hashtext('tidal_ats_interview_schedule'))");

      const appResult = await client.query('SELECT id FROM applications WHERE id=$1 FOR UPDATE', [id]);
      if (!appResult.rowCount) {
        await client.query('ROLLBACK');
        return { ok: false, reason: 'not_found', application: null };
      }

      const conflict = await client.query(
        `SELECT 1 FROM interviews
         WHERE application_id <> $1 AND scheduled_at IS NOT NULL
           AND abs(extract(epoch FROM (scheduled_at::timestamptz - $2::timestamptz))*1000) < $3
         LIMIT 1`,
        [id, new Date(requestedMs).toISOString(), conflictWindowMs]
      );
      if (conflict.rowCount) {
        await client.query('ROLLBACK');
        return { ok: false, reason: 'conflict', application: null };
      }

      const i = interviewData;
      const now = Date.now();
      await client.query(
        `INSERT INTO interviews
          (application_id,scheduled_at,interviewer,type,meeting_link,notes,email_subject,email_body,attachments,scheduled_by,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (application_id) DO UPDATE SET
           scheduled_at=EXCLUDED.scheduled_at, interviewer=EXCLUDED.interviewer,
           type=EXCLUDED.type, meeting_link=EXCLUDED.meeting_link, notes=EXCLUDED.notes,
           email_subject=EXCLUDED.email_subject, email_body=EXCLUDED.email_body,
           attachments=EXCLUDED.attachments, scheduled_by=EXCLUDED.scheduled_by,
           created_at=EXCLUDED.created_at`,
        [id, new Date(requestedMs).toISOString(), i.interviewer || '', i.type || 'Interview',
          i.meetingLink || '', i.notes || '', i.emailSubject || '', i.emailBody || '',
          JSON.stringify(i.attachments || []), i.scheduledBy || '', i.createdAt || now]
      );
      await client.query(
        "UPDATE applications SET stage='Interview Scheduled', updated_at=$2 WHERE id=$1",
        [id, now]
      );
      await client.query('COMMIT');
      return { ok: true, reason: null, application: await this.getApplicationById(id) };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* Keep the original failure. */ }
      throw error;
    } finally {
      client.release();
    }
  }
  async deleteApplication(id) { await this.ready(); const r=await this.pool.query('DELETE FROM applications WHERE id=$1',[id]); return r.rowCount>0; }

  async getEmailLogs() { await this.ready(); const {rows}=await this.pool.query('SELECT * FROM email_logs ORDER BY created_at DESC'); return rows; }
  async createEmailLog(d) {
    await this.ready(); const now=Date.now(); const id=d.id||`email-${now}-${crypto.randomBytes(5).toString('hex')}`;
    const {rows}=await this.pool.query(`INSERT INTO email_logs(id,idempotency_key,to_addresses,subject,type,status,attempts,provider_message_id,error,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL
      DO UPDATE SET updated_at=EXCLUDED.updated_at RETURNING *`, 
      [id,d.idempotencyKey||null,JSON.stringify(Array.isArray(d.to)?d.to:[d.to].filter(Boolean)),String(d.subject||'').slice(0,200),d.type||'transactional',d.status||'pending',Number(d.attempts||0),d.providerMessageId||null,d.error||null,now,now]);
    return rows[0];
  }
  async updateEmailLog(id,updates) {
    await this.ready(); const {rows}=await this.pool.query(`UPDATE email_logs SET status=COALESCE($2,status),attempts=COALESCE($3,attempts),provider_message_id=COALESCE($4,provider_message_id),error=$5,updated_at=$6 WHERE id=$1 RETURNING *`,
      [id,updates.status,updates.attempts,updates.providerMessageId,updates.error??null,Date.now()]); return rows[0]||null;
  }

  async getNotificationsForUser(user) {
    await this.ready(); const userId=typeof user==='object'?user?.id:user; if(!userId)return [];
    const {rows}=await this.pool.query('SELECT * FROM notifications WHERE recipient_user_id=$1 ORDER BY sent_at DESC',[userId]);
    return rows.map(r=>({id:r.id,applicationId:r.application_id,recipientUserId:r.recipient_user_id,jobId:r.job_id,recipientEmail:r.recipient_email,recipientName:r.recipient_name,stage:r.stage,subject:r.subject,body:r.body,deliveryStatus:r.delivery_status,deliveryError:r.delivery_error,providerMessageId:r.provider_message_id,emailType:r.email_type,sentAt:Number(r.sent_at),read:r.read}));
  }
  async createNotification(d) {
    await this.ready(); const n={id:d.id||`notif-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,...d,sentAt:Date.now(),read:false};
    const {rows}=await this.pool.query(`INSERT INTO notifications(id,application_id,recipient_user_id,job_id,recipient_email,recipient_name,stage,subject,body,delivery_status,delivery_error,provider_message_id,email_type,sent_at,read)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [n.id,n.applicationId||null,n.recipientUserId,n.jobId||null,n.recipientEmail,n.recipientName,n.stage,n.subject,n.body,n.deliveryStatus||'sent',n.deliveryError||null,n.providerMessageId||null,n.emailType||'notification',n.sentAt,false]);
    return this._mapNotification(rows[0]);
  }
  _mapNotification(r){return r?{id:r.id,applicationId:r.application_id,recipientUserId:r.recipient_user_id,jobId:r.job_id,recipientEmail:r.recipient_email,recipientName:r.recipient_name,stage:r.stage,subject:r.subject,body:r.body,deliveryStatus:r.delivery_status,deliveryError:r.delivery_error,providerMessageId:r.provider_message_id,emailType:r.email_type,sentAt:Number(r.sent_at),read:r.read}:null;}
  async markNotificationAsRead(id,userId) { await this.ready(); const uid=typeof userId==='object'?userId?.id:userId; const {rows}=await this.pool.query('UPDATE notifications SET read=true WHERE id=$1 AND recipient_user_id=$2 RETURNING *',[id,uid]); return this._mapNotification(rows[0]); }
  async updateNotification(id,updates) { await this.ready(); const {rows}=await this.pool.query('UPDATE notifications SET delivery_status=COALESCE($2,delivery_status),delivery_error=$3,provider_message_id=COALESCE($4,provider_message_id) WHERE id=$1 RETURNING *',[id,updates.deliveryStatus,updates.deliveryError??null,updates.providerMessageId]); return this._mapNotification(rows[0]); }
  async deleteNotificationForUser(id,user) { await this.ready(); const uid=typeof user==='object'?user?.id:user; const {rows}=await this.pool.query('DELETE FROM notifications WHERE id=$1 AND recipient_user_id=$2 RETURNING *',[id,uid]); return this._mapNotification(rows[0]); }
  async clearNotificationsForUser(user) { await this.ready(); const uid=typeof user==='object'?user?.id:user; const r=await this.pool.query('DELETE FROM notifications WHERE recipient_user_id=$1',[uid]); return r.rowCount; }

  async enqueueEmail(d) {
    await this.ready();
    const id = d.id || `queue-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
    const now = Date.now();
    const emailLogId = d.emailLogId || null;
    const { rows } = await this.pool.query(
      `INSERT INTO email_queue
        (id,email_log_id,payload,status,attempts,available_at,created_at)
       VALUES ($1,$2,$3,'pending',0,$4,$5)
       ON CONFLICT (email_log_id) WHERE email_log_id IS NOT NULL
       DO UPDATE SET
         payload=CASE WHEN email_queue.status='failed' THEN EXCLUDED.payload ELSE email_queue.payload END,
         status=CASE WHEN email_queue.status='failed' THEN 'pending' ELSE email_queue.status END,
         attempts=CASE WHEN email_queue.status='failed' THEN 0 ELSE email_queue.attempts END,
         available_at=CASE WHEN email_queue.status='failed' THEN EXCLUDED.available_at ELSE email_queue.available_at END,
         locked_at=CASE WHEN email_queue.status='failed' THEN NULL ELSE email_queue.locked_at END,
         last_error=CASE WHEN email_queue.status='failed' THEN NULL ELSE email_queue.last_error END
       RETURNING id`,
      [id, emailLogId, JSON.stringify(d.payload || {}), now, now]
    );
    if (rows[0]) return { id: rows[0].id };
    if (emailLogId) {
      const existing = await this.pool.query(
        `SELECT id FROM email_queue WHERE email_log_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [emailLogId]
      );
      if (existing.rows[0]) return { id: existing.rows[0].id, deduplicated: true };
    }
    return { id };
  }

  async claimEmailJobs(limit = 10) {
    await this.ready();
    const client = await this.pool.connect();
    const now = Date.now();
    const leaseMs = Math.max(60_000, Number(process.env.EMAIL_WORKER_LEASE_MS || 5 * 60 * 1000));
    const maxRetries = Math.max(1, Number(process.env.EMAIL_MAX_RETRIES || 3));
    try {
      await client.query('BEGIN');

      // Recover jobs abandoned by a worker crash. Count the abandoned attempt and cap retries.
      const stale = await client.query(
        `UPDATE email_queue
         SET attempts=attempts+1,
             status=CASE WHEN attempts+1 >= $3 THEN 'failed' ELSE 'pending' END,
             locked_at=NULL,
             available_at=$1,
             last_error=COALESCE(last_error, 'Email worker lease expired; job was reclaimed.')
         WHERE status='processing' AND locked_at IS NOT NULL AND locked_at < $2
         RETURNING email_log_id,status,attempts,last_error`,
        [now, now - leaseMs, maxRetries]
      );
      for (const row of stale.rows) {
        if (row.email_log_id && row.status === 'failed') {
          await client.query(
            `UPDATE email_logs SET status='failed',attempts=$2,error=$3,updated_at=$4 WHERE id=$1`,
            [row.email_log_id, row.attempts, row.last_error, now]
          );
        } else if (row.email_log_id) {
          await client.query(
            `UPDATE email_logs SET status='retrying',attempts=$2,error=$3,updated_at=$4 WHERE id=$1`,
            [row.email_log_id, row.attempts, row.last_error, now]
          );
        }
      }

      const { rows } = await client.query(
        `SELECT * FROM email_queue
         WHERE status='pending' AND available_at <= $1
         ORDER BY created_at ASC
         LIMIT $2 FOR UPDATE SKIP LOCKED`,
        [now, Math.max(1, Math.min(100, Number(limit) || 10))]
      );
      if (!rows.length) {
        await client.query('COMMIT');
        return [];
      }
      const ids = rows.map(row => row.id);
      await client.query(
        `UPDATE email_queue SET status='processing',locked_at=$1 WHERE id=ANY($2::text[])`,
        [now, ids]
      );
      await client.query('COMMIT');
      return rows.map(row => ({
        id: row.id, emailLogId: row.email_log_id, payload: row.payload, attempts: row.attempts
      }));
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* Preserve original error. */ }
      throw error;
    } finally {
      client.release();
    }
  }

  async completeEmailJob(id, { ok, error, nextAttemptAt }) {
    await this.ready();
    if (ok) {
      await this.pool.query('DELETE FROM email_queue WHERE id=$1', [id]);
      return;
    }
    const maxRetries = Math.max(1, Number(process.env.EMAIL_MAX_RETRIES || 3));
    await this.pool.query(
      `UPDATE email_queue
       SET status=CASE WHEN attempts+1 >= $2 THEN 'failed' ELSE 'pending' END,
           attempts=attempts+1, available_at=$3, locked_at=NULL, last_error=$4
       WHERE id=$1`,
      [id, maxRetries, nextAttemptAt || Date.now(), error || null]
    );
  }

  async getPersistenceStatus(){ await this.ready(); const {rows}=await this.pool.query(`SELECT current_database() AS database`); return {driver:'postgresql',database:rows[0]?.database||null,backupCount:null,backupDir:null}; }
  async save(){}
  async createBackup(){ return {driver:'postgresql',message:'Use managed PostgreSQL backups or pg_dump for database backups.'}; }
}
