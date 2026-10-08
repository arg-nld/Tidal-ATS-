const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTP_URL_PATTERN = /^https?:\/\//i;
import { validateUploadedFile } from './uploadSecurity.js';
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function cleanString(value, { field, max, min = 0, allowEmpty = true, singleLine = false } = {}) {
  if (value === undefined || value === null) {
    if (allowEmpty) return '';
    throw new Error(`${field} is required.`);
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${field} must be a string.`);
  }

  const normalized = String(value).replace(CONTROL_CHARS, '').trim();
  if (!allowEmpty && !normalized) throw new Error(`${field} is required.`);
  if (normalized.length < min) throw new Error(`${field} must be at least ${min} characters.`);
  if (normalized.length > max) throw new Error(`${field} must be ${max} characters or fewer.`);
  if (singleLine && /[\r\n]/.test(normalized)) throw new Error(`${field} must be a single line.`);
  return normalized;
}

function validEmail(value) {
  const email = cleanString(value, { field: 'Email', max: 254, min: 3, allowEmpty: false });
  if (!EMAIL_PATTERN.test(email)) throw new Error('Email address is invalid.');
  return email.toLowerCase();
}

function validUrl(value, field = 'Meeting link') {
  const url = cleanString(value, { field, max: 2048, allowEmpty: true });
  if (!url) return '';
  if (!HTTP_URL_PATTERN.test(url)) throw new Error(`${field} must use http:// or https://.`);
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch {
    throw new Error(`${field} must be a valid URL.`);
  }
  return url;
}

function skillList(value, field) {
  if (value === undefined || value === null || value === '') return [];
  let list;
  if (Array.isArray(value)) {
    list = value;
  } else {
    const raw = String(value);
    try {
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : raw.split(',');
    } catch {
      list = raw.split(',');
    }
  }

  if (list.length > 30) throw new Error(`${field} may contain at most 30 items.`);
  return list.map((item, index) => cleanString(item, {
    field: `${field}[${index}]`,
    max: 80,
    allowEmpty: false
  }));
}

export function validateLoginBody(req, res, next) {
  try {
    req.body.email = validEmail(req.body.email);
    req.body.password = cleanString(req.body.password, { field: 'Password', max: 128, min: 1, allowEmpty: false });
    next();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export function validateRegistrationBody(req, res, next) {
  try {
    req.body.firstName = cleanString(req.body.firstName, { field: 'First name', max: 80, allowEmpty: false });
    req.body.lastName = cleanString(req.body.lastName, { field: 'Last name', max: 80, allowEmpty: false });
    req.body.middleInitial = cleanString(req.body.middleInitial, { field: 'Middle initial', max: 2, allowEmpty: true });
    req.body.suffix = cleanString(req.body.suffix, { field: 'Suffix', max: 20, allowEmpty: true });
    req.body.email = validEmail(req.body.email);
    req.body.password = cleanString(req.body.password, { field: 'Password', max: 128, min: 8, allowEmpty: false });
    req.body.title = cleanString(req.body.title, { field: 'Title', max: 150, allowEmpty: true });
    req.body.company = cleanString(req.body.company, { field: 'Company', max: 200, allowEmpty: true });
    req.body.phone = cleanString(req.body.phone, { field: 'Phone', max: 50, allowEmpty: true });
    next();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export function validateAiBody(req, res, next) {
  try {
    const body = req.body || {};
    if (body.text !== undefined) {
      body.text = cleanString(body.text, { field: 'Resume text', max: 100000, min: 20, allowEmpty: false });
    }
    if (body.base64 !== undefined) {
      body.base64 = cleanString(body.base64, { field: 'Resume data', max: 900000, min: 20, allowEmpty: false });
      if (!/^[A-Za-z0-9+/=\r\n]+$/.test(body.base64)) throw new Error('Resume data is not valid base64.');
      const decoded = Buffer.from(body.base64, 'base64');
      if (!decoded.length || decoded.length > 15 * 1024 * 1024) throw new Error('Resume data is empty or exceeds the 15 MB limit.');
      if (body.mimeType) {
        const extensionByMime = {
          'application/pdf': '.pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
          'text/plain': '.txt'
        };
        const detected = validateUploadedFile({
          originalname: `resume${extensionByMime[body.mimeType] || ''}`,
          mimetype: body.mimeType,
          size: decoded.length,
          buffer: decoded
        }, { kind: 'resume' });
        if (!detected.ok) throw new Error(`Resume data failed file validation: ${detected.error}`);
      }
    }
    if (body.mimeType !== undefined) {
      body.mimeType = cleanString(body.mimeType, { field: 'MIME type', max: 100, allowEmpty: false, singleLine: true }).toLowerCase();
      const allowedMimeTypes = new Set([
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ]);
      if (!allowedMimeTypes.has(body.mimeType)) throw new Error('Unsupported resume MIME type. Use PDF, DOCX, or TXT.');
    }
    if (!body.text && !body.base64 && !req.file) throw new Error('No resume content or file provided.');
    if ([body.text, body.base64, req.file].filter(Boolean).length > 1) throw new Error('Provide only one resume input: text, base64 data, or file.');
    if ((body.base64 && !body.mimeType) || (!body.base64 && body.mimeType)) throw new Error('Resume data and MIME type must be provided together.');
    next();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export function validateApplicationBody(req, res, next) {
  try {
    req.body.name = cleanString(req.body.name, { field: 'Candidate name', max: 120, allowEmpty: false });
    req.body.email = validEmail(req.body.email);
    req.body.phone = cleanString(req.body.phone, { field: 'Phone', max: 50, allowEmpty: true });
    req.body.role = cleanString(req.body.role, { field: 'Role', max: 150, allowEmpty: true });
    req.body.experienceSummary = cleanString(req.body.experienceSummary, { field: 'Experience summary', max: 5000, allowEmpty: true });
    req.body.resumeText = cleanString(req.body.resumeText, { field: 'Resume text', max: 100000, allowEmpty: true });
    req.body.fileName = cleanString(req.body.fileName, { field: 'File name', max: 255, allowEmpty: true, singleLine: true });
    req.body.skills = skillList(req.body.skills, 'Skills');

    if (req.body.fileSize !== undefined && req.body.fileSize !== '') {
      const fileSize = Number(req.body.fileSize);
      if (!Number.isFinite(fileSize) || fileSize < 0 || fileSize > 15 * 1024 * 1024) {
        throw new Error('File size is invalid or exceeds the 15 MB limit.');
      }
      req.body.fileSize = fileSize;
    }
    next();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export function validateJobBody(req, res, next) {
  try {
    if (req.body.title !== undefined) req.body.title = cleanString(req.body.title, { field: 'Job title', max: 200, allowEmpty: false });
    if (req.body.description !== undefined) req.body.description = cleanString(req.body.description, { field: 'Job description', max: 20000, allowEmpty: false });
    if (req.body.location !== undefined) req.body.location = cleanString(req.body.location, { field: 'Location', max: 200, allowEmpty: true });
    if (req.body.type !== undefined) req.body.type = cleanString(req.body.type, { field: 'Employment type', max: 100, allowEmpty: true });
    if (req.body.experienceLevel !== undefined) req.body.experienceLevel = cleanString(req.body.experienceLevel, { field: 'Experience level', max: 100, allowEmpty: true });
    if (req.body.salaryRange !== undefined) req.body.salaryRange = cleanString(req.body.salaryRange, { field: 'Salary range', max: 100, allowEmpty: true });
    if (req.body.status !== undefined) {
      req.body.status = cleanString(req.body.status, { field: 'Job status', max: 30, allowEmpty: false }).toLowerCase();
      if (!['open', 'closed', 'draft'].includes(req.body.status)) throw new Error('Job status must be open, closed, or draft.');
    }
    if (req.body.requiredSkills !== undefined) req.body.requiredSkills = skillList(req.body.requiredSkills, 'Required skills');
    if (req.body.nonRequiredSkills !== undefined) req.body.nonRequiredSkills = skillList(req.body.nonRequiredSkills, 'Non-required skills');
    next();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export function validateStageBody(req, res, next) {
  try {
    req.body.stage = cleanString(req.body.stage, { field: 'Stage', max: 50, allowEmpty: false });
    req.body.customNote = cleanString(req.body.customNote, { field: 'Recruiter note', max: 5000, allowEmpty: true });
    next();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export function validateNotesBody(req, res, next) {
  try {
    req.body.notes = cleanString(req.body.notes, { field: 'Recruiter notes', max: 10000, allowEmpty: true });
    next();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export function validateInterviewBody(req, res, next) {
  try {
    req.body.scheduledAt = cleanString(req.body.scheduledAt, { field: 'Interview date/time', max: 80, allowEmpty: false, singleLine: true });
    const scheduled = new Date(req.body.scheduledAt);
    if (Number.isNaN(scheduled.getTime())) throw new Error('Interview date/time is invalid.');
    if (scheduled.getTime() <= Date.now() - 60 * 1000) throw new Error('Interview date/time must be in the future.');

    req.body.interviewer = cleanString(req.body.interviewer, { field: 'Interviewer', max: 300, allowEmpty: false });
    req.body.meetingLink = validUrl(req.body.meetingLink, 'Meeting link');
    req.body.notes = cleanString(req.body.notes, { field: 'Interview notes', max: 5000, allowEmpty: true });
    req.body.emailSubject = cleanString(req.body.emailSubject, { field: 'Email subject', max: 200, allowEmpty: true, singleLine: true });
    req.body.emailBody = cleanString(req.body.emailBody, { field: 'Email body', max: 10000, allowEmpty: true });
    next();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export function validateEvaluationBody(req, res, next) {
  try {
    const rating = Number(req.body.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5.');
    req.body.rating = rating;
    req.body.recommendation = cleanString(req.body.recommendation, { field: 'Recommendation', max: 80, allowEmpty: true });
    req.body.comments = cleanString(req.body.comments, { field: 'Evaluation comments', max: 5000, allowEmpty: true });
    next();
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export { cleanString, validEmail, validUrl };
