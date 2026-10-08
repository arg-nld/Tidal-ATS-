import test from 'node:test';
import assert from 'node:assert/strict';
import { validateUploadedFile } from '../middleware/uploadSecurity.js';
import { validateParsedResume } from '../services/aiValidation.js';
import { validEmail, validUrl } from '../middleware/inputValidation.js';

test('rejects a fake PDF whose extension is .pdf but content is HTML', () => {
  const result = validateUploadedFile({ originalname: 'resume.pdf', mimetype: 'application/pdf', size: 40, buffer: Buffer.from('<html><script>alert(1)</script></html>') }, { kind: 'resume' });
  assert.equal(result.ok, false);
});

test('accepts a minimal valid PDF signature', () => {
  const result = validateUploadedFile({ originalname: 'resume.pdf', mimetype: 'application/pdf', size: 5, buffer: Buffer.from('%PDF-') }, { kind: 'resume' });
  assert.equal(result.ok, true);
  assert.equal(result.type, 'pdf');
});

test('rejects executable-like resume MIME types', () => {
  const result = validateUploadedFile({ originalname: 'resume.exe', mimetype: 'application/x-msdownload', size: 10, buffer: Buffer.from('MZ') }, { kind: 'resume' });
  assert.equal(result.ok, false);
});

test('rejects unsafe meeting links', () => {
  assert.throws(() => validUrl('javascript:alert(1)', 'Meeting link'));
  assert.equal(validUrl('https://meet.google.com/example', 'Meeting link'), 'https://meet.google.com/example');
});

test('validates and restricts AI resume output to the expected structure', () => {
  const result = validateParsedResume({
    name: 'Jane Doe', email: 'jane@example.com', phone: '+1 555 1234', role: 'Data Analyst',
    skills: ['Python', 'SQL'], experienceSummary: 'Analyst with five years of experience.',
    education: 'BS Computer Science', resumeText: 'Jane Doe\nData Analyst\nPython\nSQL',
    maliciousField: 'should be dropped'
  });
  assert.deepEqual(result, {
    name: 'Jane Doe', email: 'jane@example.com', phone: '+1 555 1234', role: 'Data Analyst',
    skills: ['Python', 'SQL'], experienceSummary: 'Analyst with five years of experience.',
    education: 'BS Computer Science', resumeText: 'Jane Doe\nData Analyst\nPython\nSQL'
  });
});

test('rejects malformed AI email output', () => {
  assert.throws(() => validateParsedResume({ name: 'Jane Doe', email: 'not-an-email', phone: '', role: 'Analyst', skills: [], experienceSummary: '', education: '', resumeText: 'Resume' }));
});

test('rejects malformed email addresses', () => {
  assert.throws(() => validEmail('invalid-email'));
  assert.equal(validEmail('Jane@example.com'), 'jane@example.com');
});
