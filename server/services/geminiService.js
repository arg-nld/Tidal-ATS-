/**
 * Backend Gemini AI Service
 * Gemini API keys remain server-side in GEMINI_API_KEY.
 */

const GEMINI_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash'
];

function getGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error('Gemini AI is not configured. Add GEMINI_API_KEY to the project .env and restart the backend.');
  }
  return key;
}

function extractGeminiError(responseText, fallback) {
  try {
    const parsed = JSON.parse(responseText);
    return parsed?.error?.message || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Resilient Gemini REST caller with model fallbacks.
 */
export async function callGeminiApi({ contents, generationConfig, systemInstruction }) {
  const apiKey = getGeminiApiKey();
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      const payload = { contents };
      if (generationConfig) payload.generationConfig = generationConfig;
      if (systemInstruction) payload.systemInstruction = systemInstruction;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(payload)
        }
      );

      const responseText = await response.text();

      if (!response.ok) {
        const message = extractGeminiError(
          responseText,
          `Gemini API request failed with HTTP ${response.status}.`
        );

        // Try the next model only when this model itself is unavailable.
        if ([404, 429, 500, 502, 503, 504].includes(response.status)) {
          console.warn(`[Gemini] Model ${model} unavailable (${response.status}); trying fallback.`);
          lastError = new Error(message);
          continue;
        }

        throw new Error(message);
      }

      const result = JSON.parse(responseText);
      const text = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('')?.trim();
      if (!text) {
        const finishReason = result.candidates?.[0]?.finishReason;
        throw new Error(
          finishReason
            ? `Gemini returned no text (finish reason: ${finishReason}).`
            : 'Gemini returned an empty response.'
        );
      }

      return text;
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini] Attempt with ${model} failed:`, err.message || err);

      // Network errors can be transient; continue to a fallback model.
      if (err instanceof TypeError || /fetch|network|timeout/i.test(err.message || '')) {
        continue;
      }
      if (!/available|HTTP 4|HTTP 5/i.test(err.message || '')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Failed to communicate with Gemini AI.');
}

/**
 * Extract JSON from Gemini text response (strips markdown code blocks)
 */
export function extractJsonFromText(rawText) {
  if (!rawText) return null;
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Could not parse structured JSON from AI output.");
  }
}

/**
 * Screen a candidate against a job using Gemini AI
 * Returns { score: number, rationale: string }
 */
export async function screenCandidateWithAI(candidateResumeText, jobTitle, jobDepartment, jobDescription) {
  const prompt = `Act as an expert technical recruiter and talent assessor.
Evaluate the candidate's resume against the target job requirements.

Target Job Title: ${jobTitle}
Department: ${jobDepartment || 'General'}
Target Job Description:
${jobDescription || 'N/A'}

Candidate Resume:
${candidateResumeText}

Evaluate strictly based on the provided resume content.
Return a valid JSON object with exactly two keys:
- "score": A number from 0 to 100 representing the relevance and qualification match.
- "rationale": A concise 1-2 sentence explanation for the assigned score.

Respond ONLY with valid JSON.`;

  const textResponse = await callGeminiApi({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          score: { type: "number" },
          rationale: { type: "string" }
        },
        required: ["score", "rationale"]
      }
    }
  });

  return extractJsonFromText(textResponse);
}

/**
 * Parse resume text with Gemini AI
 */
export async function parseResumeTextWithAI(extractedText) {
  const prompt = `You are an expert recruiter and resume parser for an ATS (Applicant Tracking System).
Analyze the following resume text extracted from a candidate's file.

Resume Text:
"""
${extractedText}
"""

Extract structured information in JSON format with these exact keys:
- "name": Candidate's full name (e.g. "Jane Doe")
- "email": Candidate's email address or empty string
- "phone": Candidate's phone number or empty string
- "role": Candidate's primary title / target role
- "skills": Array of key technical & professional skills as strings (max 10)
- "experienceSummary": Brief 1-2 sentence summary of background
- "education": Candidate's highest degree or university
- "resumeText": Clean, formatted full text of the resume preserving all sections, contact info, experience, and education.

Respond ONLY with valid JSON.`;

  const textResponse = await callGeminiApi({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  });

  return extractJsonFromText(textResponse);
}

/**
 * Parse resume from binary file (PDF, image) with Gemini AI
 */
export async function parseResumeBinaryWithAI(base64Data, mimeType) {
  const prompt = `You are an expert AI resume parser for an ATS (Applicant Tracking System).
Examine this uploaded resume document carefully. Read and transcribe all sections.

Extract structured information in JSON format with these exact keys:
- "name": Candidate's full name (e.g. "Jane Doe")
- "email": Candidate's email address or empty string
- "phone": Candidate's phone number or empty string
- "role": Candidate's primary title / target role
- "skills": Array of key technical & professional skills as strings (max 10)
- "experienceSummary": Brief 1-2 sentence summary of background
- "education": Candidate's highest degree or university
- "resumeText": Clean, fully extracted and formatted text of the entire resume including contact info, work history, skills, and education.

Respond ONLY with valid JSON.`;

  const textResponse = await callGeminiApi({
    contents: [{
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: prompt }
      ]
    }],
    generationConfig: { responseMimeType: "application/json" }
  });

  return extractJsonFromText(textResponse);
}
