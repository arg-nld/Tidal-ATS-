import { useState } from 'react';
import { api } from '../../services/api';
import { 
  Star, CheckCircle2, MessageSquare, ThumbsUp, ThumbsDown,
  AlertCircle, ShieldCheck, Sparkles, User, Calendar, Plus, Award
} from 'lucide-react';
import { Spinner } from '../common/Spinner';

const RECOMMENDATIONS = [
  { label: 'Strong Hire', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { label: 'Hire', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  { label: 'Hold', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { label: 'Do Not Hire', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' }
];

export function ScorecardTab({ candidate: propCandidate, application, job, onUpdateCandidate: propOnUpdate, onUpdateApplication }) {
  const candidate = propCandidate || application || {};
  const onUpdateCandidate = propOnUpdate || onUpdateApplication || (() => {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Criteria from job or fallback defaults
  const criteria = job?.scorecardCriteria?.length > 0 ? job.scorecardCriteria : [
    { id: 'crit-tech', name: 'Technical Competency', description: 'Depth of skills and architecture knowledge', maxScore: 5 },
    { id: 'crit-comm', name: 'Communication & Collaboration', description: 'Clarity, listening skills, and teamwork', maxScore: 5 },
    { id: 'crit-prob', name: 'Problem Solving', description: 'Analytical approach, trade-offs, and debugging', maxScore: 5 },
    { id: 'crit-cult', name: 'Values & Culture Alignment', description: 'Curiosity, ownership, and integrity', maxScore: 5 }
  ];

  // Scorecard Form state
  const [ratings, setRatings] = useState(() => {
    const initial = {};
    criteria.forEach(c => { initial[c.id] = 4; });
    return initial;
  });
  const [overallRating, setOverallRating] = useState(4);
  const [recommendation, setRecommendation] = useState('Hire');
  const [comments, setComments] = useState('');
  const [interviewerName, setInterviewerName] = useState('');

  const scorecards = candidate.scorecards || [];

  // Summary calculations
  const totalScorecards = scorecards.length;
  const avgRating = totalScorecards > 0
    ? (scorecards.reduce((sum, s) => sum + (Number(s.overallRating) || 0), 0) / totalScorecards).toFixed(1)
    : null;

  const recCounts = { 'Strong Hire': 0, 'Hire': 0, 'Hold': 0, 'Do Not Hire': 0 };
  scorecards.forEach(s => {
    if (recCounts[s.recommendation] !== undefined) recCounts[s.recommendation]++;
  });

  const criteriaAverages = {};
  criteria.forEach(c => {
    let sum = 0;
    let count = 0;
    scorecards.forEach(s => {
      const match = s.criteriaRatings?.find(cr => cr.criterionId === c.id || cr.criterionName === c.name);
      if (match && match.score) {
        sum += Number(match.score);
        count++;
      }
    });
    if (count > 0) criteriaAverages[c.name] = (sum / count).toFixed(1);
  });

  const handleSubmitScorecard = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const criteriaRatings = criteria.map(c => ({
        criterionId: c.id,
        criterionName: c.name,
        score: ratings[c.id] || 3
      }));

      const payload = {
        criteriaRatings,
        overallRating,
        recommendation,
        comments,
        interviewerName: interviewerName.trim() || undefined
      };

      const res = await api.applications.recordScorecard(candidate.id, payload);
      onUpdateCandidate(res.application);
      setSuccess(true);
      setComments('');
      setTimeout(() => setSuccess(false), 3500);
    } catch (err) {
      setError(err.message || 'Failed to record scorecard');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Combined Evaluation Summary for HR */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Award size={16} className="text-indigo-400" />
              Combined Evaluation Summary
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Aggregated ratings from all interviewers</p>
          </div>
          <span className="text-[11px] font-mono bg-slate-900 text-slate-300 px-2 py-1 rounded-lg border border-slate-800">
            {totalScorecards} {totalScorecards === 1 ? 'Scorecard' : 'Scorecards'} Submitted
          </span>
        </div>

        {totalScorecards > 0 ? (
          <div className="grid md:grid-cols-3 gap-4">
            
            {/* Average Rating Box */}
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-center flex flex-col justify-center">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Overall Rating</span>
              <div className="text-3xl font-black text-indigo-400 my-1">{avgRating}<span className="text-sm font-normal text-slate-500"> / 5.0</span></div>
              <div className="flex items-center justify-center gap-1 text-amber-400 text-xs">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    size={14}
                    fill={star <= Math.round(Number(avgRating)) ? 'currentColor' : 'none'}
                    className={star <= Math.round(Number(avgRating)) ? 'text-amber-400' : 'text-slate-700'}
                  />
                ))}
              </div>
            </div>

            {/* Recommendation Distribution */}
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1.5 md:col-span-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-2">Interviewer Recommendations</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {Object.entries(recCounts).map(([rec, count]) => {
                  const item = RECOMMENDATIONS.find(r => r.label === rec);
                  return (
                    <div key={rec} className={`p-2 rounded-lg border text-center ${item?.color || 'bg-slate-800 text-slate-300'}`}>
                      <div className="font-mono text-base font-bold">{count}</div>
                      <div className="text-[10px] font-medium truncate">{rec}</div>
                    </div>
                  );
                })}
              </div>

              {/* Criteria Averages Breakdown */}
              {Object.keys(criteriaAverages).length > 0 && (
                <div className="pt-2 mt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
                  {Object.entries(criteriaAverages).map(([critName, score]) => (
                    <div key={critName} className="flex justify-between items-center bg-slate-950/60 px-2 py-1 rounded">
                      <span className="text-slate-400 truncate pr-1">{critName}:</span>
                      <span className="font-mono font-bold text-slate-200">{score}/5</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-500">
            No scorecards recorded yet. Fill out the evaluation form below to add the first scorecard.
          </div>
        )}
      </div>

      {/* 2. Previous Individual Scorecards */}
      {scorecards.length > 0 && (
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Individual Scorecard History
          </h3>
          <div className="space-y-3">
            {scorecards.map((sc, idx) => {
              const recItem = RECOMMENDATIONS.find(r => r.label === sc.recommendation);
              return (
                <div key={sc.id || idx} className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center">
                        {sc.interviewerName?.charAt(0) || 'I'}
                      </div>
                      <span className="text-xs font-semibold text-slate-200">{sc.interviewerName}</span>
                      <span className="text-[11px] text-slate-500">
                        {sc.submittedAt ? new Date(sc.submittedAt).toLocaleDateString() : '—'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-400 flex items-center gap-1">
                        <Star size={12} fill="currentColor" /> {sc.overallRating}/5
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${recItem?.color || 'bg-slate-800'}`}>
                        {sc.recommendation}
                      </span>
                    </div>
                  </div>

                  {sc.criteriaRatings?.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {sc.criteriaRatings.map((cr, cIdx) => (
                        <span key={cIdx} className="text-[10px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                          {cr.criterionName}: <span className="font-bold text-indigo-400">{cr.score}/5</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {sc.comments && (
                    <p className="text-xs text-slate-300 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                      "{sc.comments}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. New Interview Scorecard Form */}
      <form onSubmit={handleSubmitScorecard} className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Plus size={16} className="text-indigo-400" />
              Submit Interview Scorecard
            </h3>
            <p className="text-xs text-slate-400">Evaluate candidate competencies based on job rubric</p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex gap-2">
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
            <span>Scorecard and recommendation submitted successfully!</span>
          </div>
        )}

        {/* Interviewer Name */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Interviewer Name</label>
          <input
            type="text"
            value={interviewerName}
            onChange={e => setInterviewerName(e.target.value)}
            placeholder="e.g. David Chen (Tech Lead)"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Criteria Sliders / Star Ratings */}
        <div className="space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
            Evaluation Criteria (Rating 1 - 5)
          </label>
          <div className="space-y-2.5">
            {criteria.map(crit => (
              <div key={crit.id} className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="pr-3">
                  <span className="text-xs font-semibold text-slate-200 block">{crit.name}</span>
                  <span className="text-[11px] text-slate-400">{crit.description}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                  {[1, 2, 3, 4, 5].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setRatings(prev => ({ ...prev, [crit.id]: num }))}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        ratings[crit.id] === num
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overall Rating & Hiring Recommendation */}
        <div className="grid md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Overall Rating *</label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setOverallRating(num)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                    overallRating === num
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Star size={13} fill={overallRating === num ? 'currentColor' : 'none'} />
                  <span>{num}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Hiring Recommendation *</label>
            <div className="grid grid-cols-2 gap-1.5">
              {RECOMMENDATIONS.map(rec => (
                <button
                  key={rec.label}
                  type="button"
                  onClick={() => setRecommendation(rec.label)}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all truncate text-center ${
                    recommendation === rec.label
                      ? `${rec.color} ring-2 ring-indigo-500 shadow-sm`
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rec.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Feedback Comments */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Interview Notes & Justification *
          </label>
          <textarea
            required
            rows={4}
            value={comments}
            onChange={e => setComments(e.target.value)}
            placeholder="Explain strengths, areas of concern, rationale for the recommendation, and culture alignment notes..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
          />
        </div>

        {/* Action button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Spinner className="w-3.5 h-3.5" />
                <span>Recording Scorecard...</span>
              </>
            ) : (
              <span>Submit Evaluation Scorecard</span>
            )}
          </button>
        </div>
      </form>

    </div>
  );
}
