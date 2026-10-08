import { validEmail } from '../middleware/inputValidation.js';

function stringField(value, field, max, { allowEmpty = true } = {}) {
  if (value === undefined || value === null) return allowEmpty ? '' : null;
  if (typeof value !== 'string') throw new Error(`AI output field "${field}" must be a string.`);
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (cleaned.length > max) throw new Error(`AI output field "${field}" is too long.`);
  if (!allowEmpty && !cleaned) throw new Error(`AI output field "${field}" is required.`);
  return cleaned;
}

export function validateParsedResume(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('AI returned an invalid resume structure.');
  }

  const skillsRaw = Array.isArray(raw.skills) ? raw.skills : [];
  if (skillsRaw.length > 10) throw new Error('AI returned too many skills.');

  const skills = skillsRaw
    .slice(0, 10)
    .map((skill, index) => stringField(skill, `skills[${index}]`, 80, { allowEmpty: false }));

  let email = '';
  if (raw.email) {
    email = validEmail(raw.email);
  }

  return {
    name: stringField(raw.name, 'name', 120),
    email,
    phone: stringField(raw.phone, 'phone', 50),
    role: stringField(raw.role, 'role', 150),
    skills,
    experienceSummary: stringField(raw.experienceSummary, 'experienceSummary', 5000),
    education: stringField(raw.education, 'education', 500),
    resumeText: stringField(raw.resumeText, 'resumeText', 100000)
  };
}

export function validateScreeningResult(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('AI returned an invalid screening structure.');
  }

  const score = Number(raw.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error('AI screening score must be a number from 0 to 100.');
  }

  return {
    score: Math.round(score * 100) / 100,
    rationale: stringField(raw.rationale, 'rationale', 1000, { allowEmpty: false })
  };
}
