import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCandidateScore, extractExperienceYears, extractRequiredExperience, scoreSkills, skillMatch } from '../services/scoringService.js';

test('skill matching is case-insensitive and handles aliases', () => {
  assert.equal(skillMatch('Node.js', 'Node JS and TypeScript experience'), true);
  assert.equal(skillMatch('Design Systems', 'built a design system for enterprise teams'), true);
  assert.equal(skillMatch('Java', 'JavaScript developer'), false);
});

test('scoreSkills returns full score for an empty requirement list', () => {
  assert.deepEqual(scoreSkills([], 'anything'), { score: 100, matched: [], missing: [] });
});

test('experience extraction uses the highest explicitly stated duration', () => {
  assert.equal(extractExperienceYears('3 years at A. 5+ years at B. 4 yrs at C.'), 5);
});

test('required experience is extracted from level or description', () => {
  assert.equal(extractRequiredExperience({ experienceLevel: 'Senior (5+ years)', description: '' }), 5);
  assert.equal(extractRequiredExperience({ experienceLevel: 'Senior', description: 'At least 4 years experience' }), 4);
});

test('default 70/20/10 scoring produces a bounded deterministic score', () => {
  const candidate = {
    resumeText: 'React TypeScript Node.js 6 years experience Docker',
    experienceSummary: '6 years software engineering',
    skills: ['React', 'Node.js', 'Docker']
  };
  const job = {
    requiredSkills: ['React', 'TypeScript', 'Node.js'],
    nonRequiredSkills: ['Docker', 'GraphQL'],
    experienceLevel: 'Senior (5+ years)',
    scoringWeights: { requiredSkills: 70, nonRequiredSkills: 20, experience: 10 }
  };
  const result = calculateCandidateScore(candidate, job);
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.deepEqual(result.weights, job.scoringWeights);
  assert.equal(result.matchedRequiredSkills.length, 3);
  assert.equal(result.matchedNonRequiredSkills.length, 1);
  assert.equal(result.candidateExperienceYears, 6);
});

test('changing job weights changes the final score for the same candidate', () => {
  const candidate = { resumeText: 'React Node.js 2 years experience Docker', skills: ['React', 'Node.js', 'Docker'] };
  const base = { requiredSkills: ['React', 'Node.js', 'TypeScript'], nonRequiredSkills: ['Docker', 'GraphQL'], experienceLevel: 'Senior (5+ years)' };
  const scoreA = calculateCandidateScore(candidate, { ...base, scoringWeights: { requiredSkills: 70, nonRequiredSkills: 20, experience: 10 } }).score;
  const scoreB = calculateCandidateScore(candidate, { ...base, scoringWeights: { requiredSkills: 50, nonRequiredSkills: 40, experience: 10 } }).score;
  assert.notEqual(scoreA, scoreB);
});

test('invalid weights are rejected', () => {
  assert.throws(() => calculateCandidateScore({}, { scoringWeights: { requiredSkills: 60, nonRequiredSkills: 20, experience: 20.5 } }), /must total exactly 100/);
});

test('experience requirement of zero gives full experience score', () => {
  const result = calculateCandidateScore({ resumeText: 'React' }, { requiredSkills: ['React'], nonRequiredSkills: [], experienceLevel: 'Entry' });
  assert.equal(result.breakdown.experience, 100);
});

test('missing required skills are explicitly reported', () => {
  const result = calculateCandidateScore({ resumeText: 'React TypeScript 2 years' }, { requiredSkills: ['React', 'Node.js'], nonRequiredSkills: [], experienceLevel: '2 years', scoringWeights: { requiredSkills: 100, nonRequiredSkills: 0, experience: 0 } });
  assert.deepEqual(result.missingRequiredSkills, ['Node.js']);
  assert.equal(result.score, 50);
});
