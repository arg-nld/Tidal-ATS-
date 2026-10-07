import { store } from '../services/store.js';
import mammoth from 'mammoth';
import { parseResumeTextWithAI, parseResumeBinaryWithAI } from '../services/geminiService.js';
import { calculateCandidateScore, buildDeterministicRationale } from '../services/scoringService.js';

export async function screenCandidate(req, res) {
  const { id } = req.params;
  const app = store.getApplicationById(id);
  if (!app) return res.status(404).json({ error: 'Application not found' });

  const job = store.getJobById(app.jobId);
  if (!job) return res.status(404).json({ error: 'Associated job not found' });
  if (!app.resumeText) return res.status(400).json({ error: 'Candidate has no extracted resume text to evaluate' });

  store.updateApplication(id, { isScreening: true, geminiError: null });

  try {
    const result = calculateCandidateScore(app, job);
    const rationale = buildDeterministicRationale(result);

    const updated = store.updateApplication(id, {
      geminiScore: result.score,
      geminiRationale: rationale,
      screeningBreakdown: result.breakdown,
      screeningWeights: result.weights,
      screeningMatchedRequiredSkills: result.matchedRequiredSkills,
      screeningMissingRequiredSkills: result.missingRequiredSkills,
      screeningMatchedNonRequiredSkills: result.matchedNonRequiredSkills,
      screeningMissingNonRequiredSkills: result.missingNonRequiredSkills,
      candidateExperienceYears: result.candidateExperienceYears,
      requiredExperienceYears: result.requiredExperienceYears,
      isScreening: false,
      geminiError: null,
      screeningVersion: 2
    });

    return res.json({
      application: updated,
      score: result.score,
      rationale,
      breakdown: result.breakdown,
      message: 'ATS screening completed with deterministic scoring'
    });
  } catch (err) {
    console.error('[AIController] Screening error:', err);
    store.updateApplication(id, { isScreening: false, geminiError: err.message || 'Failed to complete screening' });
    return res.status(400).json({ error: err.message || 'Failed to evaluate candidate' });
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
      if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || req.file.originalname?.toLowerCase().endsWith('.docx')) {
        const extracted = await mammoth.extractRawText({ buffer: req.file.buffer });
        const docxText = extracted.value?.trim();
        if (!docxText) return res.status(422).json({ error: 'The DOCX file contains no readable text.' });
        parsed = await parseResumeTextWithAI(docxText);
      } else {
        const b64 = req.file.buffer.toString('base64');
        parsed = await parseResumeBinaryWithAI(b64, req.file.mimetype);
      }
    } else {
      return res.status(400).json({ error: 'No resume content or file provided' });
    }

    return res.json({ parsed });
  } catch (err) {
    console.error('[AIController] Parse error:', err);
    return res.status(500).json({ error: err.message || 'Failed to parse resume with AI' });
  }
}
