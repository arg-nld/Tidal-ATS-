/**
 * Client-side Gemini helpers are routed through the backend API so the Gemini
 * API key is never shipped to the browser.
 */

import { api } from './api';

export function parseResumeWithGemini(payload) {
  return api.ai.parseResume(payload);
}

export function parseResumeFileWithGemini(formData) {
  return api.ai.parseResumeFile(formData);
}
