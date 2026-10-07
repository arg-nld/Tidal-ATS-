function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchText(candidate) {
  return normalize([
    candidate?.resumeText,
    candidate?.experienceSummary,
    Array.isArray(candidate?.skills) ? candidate.skills.join(' ') : ''
  ].filter(Boolean).join(' '));
}

function skillVariants(skill) {
  const normalized = normalize(skill);
  const variants = new Set([normalized]);

  const aliases = {
    'node js': ['node.js', 'nodejs'],
    'node.js': ['node js', 'nodejs'],
    'rest api': ['rest apis', 'rest api'],
    'rest apis': ['rest api', 'rest apis'],
    'type script': ['typescript'],
    'typescript': ['type script'],
    'java script': ['javascript'],
    'javascript': ['java script'],
    'design system': ['design systems'],
    'design systems': ['design system'],
    'ci cd': ['ci/cd'],
    'ci/cd': ['ci cd'],
    'llm': ['large language model', 'large language models'],
    'rag': ['retrieval augmented generation', 'retrieval-augmented generation'],
  };

  for (const alias of aliases[normalized] || []) variants.add(normalize(alias));

  // Treat simple singular/plural forms as equivalent for common skill names.
  for (const variant of [...variants]) {
    if (variant.endsWith('ies') && variant.length > 3) variants.add(`${variant.slice(0, -3)}y`);
    else if (variant.endsWith('s') && !variant.endsWith('ss') && variant.length > 3) variants.add(variant.slice(0, -1));
    else if (!variant.endsWith('s') && variant.length > 2) variants.add(`${variant}s`);
  }

  return [...variants].filter(Boolean);
}

export function skillMatch(skill, searchText) {
  const normalizedText = normalize(searchText);
  return skillVariants(skill).some(variant => {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '\\s+');
    return new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`, 'i').test(normalizedText);
  });
}

export function scoreSkills(skills, searchText) {
  const clean = Array.isArray(skills)
    ? skills.map(s => String(s || '').trim()).filter(Boolean)
    : [];

  if (!clean.length) return { score: 100, matched: [], missing: [] };

  const matched = clean.filter(skill => skillMatch(skill, searchText));
  const missing = clean.filter(skill => !skillMatch(skill, searchText));

  return {
    score: (matched.length / clean.length) * 100,
    matched,
    missing
  };
}

export function extractExperienceYears(text) {
  const normalized = String(text || '');
  const matches = normalized.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/gi) || [];
  if (!matches.length) return 0;

  return Math.max(...matches.map(match => {
    const number = match.match(/\d+(?:\.\d+)?/);
    return number ? Number(number[0]) : 0;
  }));
}

export function extractRequiredExperience(job) {
  const source = [job?.experienceLevel, job?.description].filter(Boolean).join(' ');
  const matches = source.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/i);
  return matches ? Number(matches[1]) : 0;
}

export function calculateCandidateScore(candidate, job) {
  const weights = {
    requiredSkills: Number(job?.scoringWeights?.requiredSkills ?? 70),
    nonRequiredSkills: Number(job?.scoringWeights?.nonRequiredSkills ?? 20),
    experience: Number(job?.scoringWeights?.experience ?? 10)
  };

  const totalWeight = weights.requiredSkills + weights.nonRequiredSkills + weights.experience;
  if (totalWeight !== 100) {
    throw new Error('Job scoring weights must total exactly 100%.');
  }

  const searchText = buildSearchText(candidate);
  const required = scoreSkills(job?.requiredSkills || [], searchText);
  const optional = scoreSkills(job?.nonRequiredSkills || [], searchText);
  const candidateYears = extractExperienceYears([
    candidate?.resumeText,
    candidate?.experienceSummary
  ].filter(Boolean).join('\n'));
  const requiredYears = extractRequiredExperience(job);
  const experienceScore = requiredYears <= 0
    ? 100
    : Math.min(100, (candidateYears / requiredYears) * 100);

  const finalScore =
    (required.score * weights.requiredSkills / 100) +
    (optional.score * weights.nonRequiredSkills / 100) +
    (experienceScore * weights.experience / 100);

  return {
    score: Math.round(finalScore * 100) / 100,
    breakdown: {
      requiredSkills: Math.round(required.score * 100) / 100,
      nonRequiredSkills: Math.round(optional.score * 100) / 100,
      experience: Math.round(experienceScore * 100) / 100
    },
    matchedRequiredSkills: required.matched,
    missingRequiredSkills: required.missing,
    matchedNonRequiredSkills: optional.matched,
    missingNonRequiredSkills: optional.missing,
    candidateExperienceYears: candidateYears,
    requiredExperienceYears: requiredYears,
    weights
  };
}

export function buildDeterministicRationale(result) {
  const requiredText = result.weights.requiredSkills
    ? `${result.matchedRequiredSkills.length}/${result.matchedRequiredSkills.length + result.missingRequiredSkills.length || 0} required skills matched`
    : 'Required-skill weighting disabled';
  const optionalText = result.weights.nonRequiredSkills
    ? `${result.matchedNonRequiredSkills.length}/${result.matchedNonRequiredSkills.length + result.missingNonRequiredSkills.length || 0} non-required skills matched`
    : 'Optional-skill weighting disabled';
  const experienceText = result.requiredExperienceYears > 0
    ? `${result.candidateExperienceYears} years detected vs ${result.requiredExperienceYears} required`
    : 'No minimum experience requirement detected';

  return `Deterministic ATS match based on the job's configured weights (${result.weights.requiredSkills}% required skills, ${result.weights.nonRequiredSkills}% non-required skills, ${result.weights.experience}% experience). ${requiredText}; ${optionalText}; ${experienceText}.`;
}
