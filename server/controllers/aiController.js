import { store } from '../services/store.js';
import { screenCandidateWithAI, parseResumeTextWithAI, parseResumeBinaryWithAI } from '../services/geminiService.js';

export async function screenCandidate(req, res) {
  const { id } = req.params;
  const app = store.getApplicationById(id);

  if (!app) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const job = store.getJobById(app.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Associated job not found' });
  }

  if (!app.resumeText) {
    return res.status(400).json({ error: 'Candidate has no extracted resume text to evaluate' });
  }

  // Mark screening in progress
  store.updateApplication(id, { isScreening: true, geminiError: null });

  try {
    const result = await screenCandidateWithAI(
      app.resumeText,
      job.title,
      job.department,
      job.description
    );

    const updated = store.updateApplication(id, {
      geminiScore: result.score,
      geminiRationale: result.rationale,
      geminiError: null,
      isScreening: false
    });

    return res.json({
      application: updated,
      score: result.score,
      rationale: result.rationale,
      message: 'AI screening completed successfully'
    });
  } catch (err) {
    console.error('[AIController] Screening error:', err);
    store.updateApplication(id, {
      isScreening: false,
      geminiError: err.message || 'Failed to complete AI screening'
    });
    return res.status(500).json({ error: err.message || 'Failed to evaluate candidate with AI' });
  }
}

export async function parseResume(req, res) {
  try {
    const { text, base64, mimeType } = req.body;

    let parsed = null;
    if (base64 && mimeType) {
      parsed = await parseResumeBinaryWithAI(base64, mimeType);
    } else if (text) {
      parsed = await parseResumeTextWithAI(text);
    } else if (req.file) {
      // From multer upload
      const b64 = req.file.buffer.toString('base64');
      parsed = await parseResumeBinaryWithAI(b64, req.file.mimetype);
    } else {
      return res.status(400).json({ error: 'No resume content or file provided' });
    }

    return res.json({ parsed });
  } catch (err) {
    console.error('[AIController] Parse error:', err);
    return res.status(500).json({ error: err.message || 'Failed to parse resume with AI' });
  }
}
