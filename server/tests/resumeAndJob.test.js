import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeOriginalFileName, getResumeFile } from '../controllers/applicationController.js';
import { getResume, putResume } from '../services/storageService.js';
import { store } from '../services/store.js';

test('sanitizeOriginalFileName cleans malicious characters and paths', () => {
  assert.equal(sanitizeOriginalFileName('my_resume.pdf'), 'my_resume.pdf');
  assert.equal(sanitizeOriginalFileName('../../secret/resume.pdf'), '.._.._secret_resume.pdf');
  assert.equal(sanitizeOriginalFileName(''), 'document');
});

test('getResumeFile sets proper content-disposition and returns buffer without ReferenceError', async () => {
  await store.ready?.();

  // Create mock upload
  const mockFile = {
    originalname: 'Test_Candidate_Resume.pdf',
    mimetype: 'application/pdf',
    size: 20,
    buffer: Buffer.from('%PDF-1.4 test resume')
  };
  const stored = await putResume(mockFile);

  // Create an application
  const app = await store.createApplication({
    jobId: 'job-test-1',
    name: 'Test Candidate',
    email: 'candidate@test.com',
    role: 'Engineer',
    fileName: 'Test_Candidate_Resume.pdf',
    resumeFile: stored
  });

  const headers = {};
  let sentBody = null;
  const mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, val) {
      headers[name] = val;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
    send(body) {
      sentBody = body;
      return this;
    }
  };

  const mockReq = {
    params: { id: app.id },
    user: { role: 'hr' }
  };

  await getResumeFile(mockReq, mockRes);

  assert.equal(headers['Content-Type'], 'application/pdf');
  assert.ok(headers['Content-Disposition'].includes('Test_Candidate_Resume.pdf'));
  assert.ok(Buffer.isBuffer(sentBody));
  assert.equal(sentBody.toString(), '%PDF-1.4 test resume');

  // Clean up
  await store.deleteApplication(app.id);
});
