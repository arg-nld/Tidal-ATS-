import { useState } from 'react';
import { api } from '../../services/api';
import { 
  X, Trash2, Mail, Phone, FileText, BrainCircuit, RefreshCw, 
  Calendar, Clock, Video, Star, Send, Check, AlertCircle, 
  CheckCircle2, Sparkles, MessageSquare, ExternalLink, UserCheck
} from 'lucide-react';
import { StageBadge } from '../common/Badge';
import { Spinner } from '../common/Spinner';

import { PIPELINE_STAGES } from '../../constants/pipeline';
export { PIPELINE_STAGES };

export function CandidateProfileModal({
  candidate,
  job,
  onClose,
  onUpdateCandidate,
  onDelete
}) {
  if (!candidate) return null;

  // Active section tab
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'interview' | 'evaluation' | 'resume'

  // Stage change state
  const [targetStage, setTargetStage] = useState(candidate.stage);
  const [stageNote, setStageNote] = useState('');
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [stageSuccess, setStageSuccess] = useState(null);

  // Recruiter notes state
  const [notes, setNotes] = useState(candidate.recruiterNotes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // AI Screening state
  const [isScreening, setIsScreening] = useState(false);
  const [screeningError, setScreeningError] = useState(null);

  const [interviewForm, setInterviewForm] = useState({
    scheduledAt: candidate.interview?.scheduledAt || '',
    interviewer: candidate.interview?.interviewer || 'Sarah Lin (Talent Lead)',
    meetingLink: candidate.interview?.meetingLink || 'https://meet.google.com/ats-technical',
    notes: candidate.interview?.notes || ''
  });
  const [isScheduling, setIsScheduling] = useState(false);
  const [interviewSuccess, setInterviewSuccess] = useState(false);

  // Evaluation form removed

  // Handlers
  const handleUpdateStage = async () => {
    if (targetStage === candidate.stage) return;
    setIsUpdatingStage(true);
    setStageSuccess(null);
    try {
      const res = await api.applications.updateStage(candidate.id, {
        stage: targetStage,
        customNote: stageNote
      });
      onUpdateCandidate(res.application);
      setStageSuccess(`Stage moved to "${targetStage}" & applicant notified via email!`);
      setTimeout(() => setStageSuccess(null), 4000);
    } catch (err) {
      alert("Failed to update stage: " + err.message);
    } finally {
      setIsUpdatingStage(false);
    }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    setNotesSaved(false);
    try {
      const res = await api.applications.updateNotes(candidate.id, notes);
      onUpdateCandidate(res.application);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 3000);
    } catch (err) {
      alert("Failed to save notes: " + err.message);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleScreenCandidate = async () => {
    setIsScreening(true);
    setScreeningError(null);
    try {
      const res = await api.ai.screen(candidate.id);
      onUpdateCandidate(res.application);
    } catch (err) {
      setScreeningError(err.message || 'AI Screening failed');
    } finally {
      setIsScreening(false);
    }
  };

  const handleScheduleInterview = async (e) => {
    e.preventDefault();
    if (!interviewForm.scheduledAt || !interviewForm.interviewer) {
      alert("Please provide interview date/time and interviewer name.");
      return;
    }
    setIsScheduling(true);
    setInterviewSuccess(false);
    try {
      const res = await api.applications.scheduleInterview(candidate.id, interviewForm);
      onUpdateCandidate(res.application);
      setInterviewSuccess(true);
      setTargetStage('Interview Scheduled');
      setTimeout(() => setInterviewSuccess(false), 4000);
    } catch (err) {
      alert("Failed to schedule interview: " + err.message);
    } finally {
      setIsScheduling(false);
    }
  };

  // handleSaveEvaluation removed

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-lg flex items-center justify-center shadow-lg shadow-indigo-600/25">
              {candidate.name?.charAt(0).toUpperCase() || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100">{candidate.name}</h2>
                <StageBadge stage={candidate.stage} size="sm" />
              </div>
              <p className="text-xs text-slate-400">
                Applied for <span className="text-slate-200 font-semibold">{job?.title || candidate.role}</span>
                {job?.department && <span> • {job.department}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onDelete(candidate)}
              className="text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-xl border border-rose-500/20 hover:bg-rose-500/10 font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 size={13} /> Delete
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 shrink-0">
          {[
            { id: 'overview', label: 'Overview & Status' },
            { id: 'interview', label: 'Interview Scheduling', badge: candidate.interview ? 'Scheduled' : null },
            { id: 'resume', label: 'Resume Content' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[10px] bg-indigo-500/15 text-indigo-400 px-1.5 py-0.2 rounded-full border border-indigo-500/30">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          
          {/* TAB 1: OVERVIEW & PIPELINE STATUS */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Pipeline Stage Transition Card */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-indigo-400" />
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Hiring Pipeline Progression & Email Trigger
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Changes notify applicant automatically
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Target Pipeline Stage
                    </label>
                    <select
                      value={targetStage}
                      onChange={(e) => setTargetStage(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {PIPELINE_STAGES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Action
                    </label>
                    <button
                      onClick={handleUpdateStage}
                      disabled={isUpdatingStage || targetStage === candidate.stage}
                      className="w-full h-9 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5"
                    >
                      {isUpdatingStage ? (
                        <>
                          <Spinner className="w-3.5 h-3.5" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <Send size={13} />
                          <span>Advance & Notify</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {stageSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    <span>{stageSuccess}</span>
                  </div>
                )}
              </div>

              {/* Top Details & AI Screening Score Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* Candidate Info Box */}
                <div className="md:col-span-2 bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Candidate Profile Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Mail size={12} /> Email Address
                      </span>
                      <span className="font-semibold text-slate-200">{candidate.email}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Phone size={12} /> Phone Number
                      </span>
                      <span className="font-semibold text-slate-200">{candidate.phone || 'Not provided'}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-500 flex items-center gap-1">
                        <FileText size={12} /> Attached Resume
                      </span>
                      <span className="font-semibold text-slate-200 font-mono">
                        {candidate.fileName || 'Online Profile Submission'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Clock size={12} /> Applied On
                      </span>
                      <span className="font-semibold text-slate-200">
                        {new Date(candidate.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {candidate.skills && candidate.skills.length > 0 && (
                    <div className="pt-2">
                      <span className="text-slate-500 text-[11px] block mb-1.5">Identified Skills:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {candidate.skills.map((skill, idx) => (
                          <span 
                            key={idx} 
                            className="bg-slate-900 text-slate-300 border border-slate-800 text-[11px] px-2.5 py-0.5 rounded-lg"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {candidate.experienceSummary && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-slate-500 text-[11px] block mb-1">Experience Summary:</span>
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                        {candidate.experienceSummary}
                      </p>
                    </div>
                  )}
                </div>

                {/* AI Screening Score Card */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <BrainCircuit size={13} className="text-indigo-400" /> AI Qualification Match
                      </span>
                    </div>

                    {candidate.geminiScore !== null && candidate.geminiScore !== undefined ? (
                      <div className="space-y-2 text-center py-2">
                        <div className={`text-4xl font-extrabold ${
                          candidate.geminiScore >= 80 ? 'text-emerald-400' :
                          candidate.geminiScore >= 60 ? 'text-amber-400' : 'text-rose-400'
                        }`}>
                          {candidate.geminiScore}
                          <span className="text-sm font-normal text-slate-500">/100</span>
                        </div>
                        <p className="text-[11px] text-slate-300 text-left bg-indigo-500/5 border border-indigo-500/20 p-3 rounded-xl leading-relaxed">
                          {candidate.geminiRationale}
                        </p>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-500 space-y-2">
                        <p>No AI screening score generated yet.</p>
                      </div>
                    )}

                    {screeningError && (
                      <p className="text-[11px] text-rose-400 mt-1">{screeningError}</p>
                    )}
                  </div>

                  <button
                    onClick={handleScreenCandidate}
                    disabled={isScreening}
                    className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-300 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isScreening ? (
                      <>
                        <Spinner className="w-3.5 h-3.5" />
                        <span>Evaluating Resume...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={12} />
                        <span>{candidate.geminiScore ? 'Re-screen with Gemini AI' : 'Run Gemini AI Screening'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Internal Recruiter Notes Text Area */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={15} className="text-indigo-400" />
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Internal Recruiter Notes
                    </h3>
                  </div>
                  {notesSaved && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <Check size={13} /> Notes saved
                    </span>
                  )}
                </div>

                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record internal interview feedback, behavioral observations, compensation requirements, or notes for the hiring committee..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
                  >
                    {isSavingNotes ? <Spinner className="w-3 h-3" /> : <Check size={14} />}
                    <span>Save Recruiter Notes</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: INTERVIEW SCHEDULING */}
          {activeTab === 'interview' && (
            <div className="space-y-6">
              
              {/* Existing Interview Summary if scheduled */}
              {candidate.interview && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                      <Calendar size={18} />
                      <span>Currently Scheduled Interview Session</span>
                    </div>
                    <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                      {candidate.interview.type}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block">Date & Time:</span>
                      <span className="font-semibold text-slate-200">
                        {new Date(candidate.interview.scheduledAt).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Interviewer:</span>
                      <span className="font-semibold text-slate-200">{candidate.interview.interviewer}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Meeting Room:</span>
                      <a 
                        href={candidate.interview.meetingLink} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Video size={12} /> {candidate.interview.meetingLink}
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Schedule Form */}
              <form onSubmit={handleScheduleInterview} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Calendar size={16} className="text-indigo-400" />
                    <span>{candidate.interview ? 'Reschedule Interview Round' : 'Schedule Candidate Interview'}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Scheduling automatically sets candidate status to "Interview Scheduled" and sends an invitation email.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Interview Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={interviewForm.scheduledAt}
                      onChange={(e) => setInterviewForm({ ...interviewForm, scheduledAt: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Interviewer(s) *
                    </label>
                    <input
                      type="text"
                      required
                      value={interviewForm.interviewer}
                      onChange={(e) => setInterviewForm({ ...interviewForm, interviewer: e.target.value })}
                      placeholder="e.g. Sarah Lin, David Chen (Lead Eng)"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Interview Type removed */}

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Video Meeting URL
                    </label>
                    <input
                      type="url"
                      value={interviewForm.meetingLink}
                      onChange={(e) => setInterviewForm({ ...interviewForm, meetingLink: e.target.value })}
                      placeholder="https://meet.google.com/xyz"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Preparation Instructions (Included in Applicant Email)
                  </label>
                  <textarea
                    rows={3}
                    value={interviewForm.notes}
                    onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
                    placeholder="Instructions for candidate: review past architectural decisions, prepare questions for the team..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  {interviewSuccess && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                      <CheckCircle2 size={15} /> Interview scheduled & email invitation dispatched!
                    </span>
                  )}
                  <div className="ml-auto">
                    <button
                      type="submit"
                      disabled={isScheduling}
                      className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2"
                    >
                      {isScheduling ? <Spinner className="w-3.5 h-3.5" /> : <Calendar size={14} />}
                      <span>Confirm & Send Automated Invitation</span>
                    </button>
                  </div>
                </div>
              </form>

            </div>
          )}

          {/* Evaluation tab removed */}

          {/* TAB 4: FULL EXTRACTED RESUME TEXT */}
          {activeTab === 'resume' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={14} className="text-indigo-400" /> Complete Extracted Resume Content
                </span>
                {candidate.fileName && (
                  <span className="text-xs text-slate-500 font-mono">
                    Source: {candidate.fileName}
                  </span>
                )}
              </div>

              <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto custom-scrollbar">
                {candidate.resumeText || 'No text extracted from this resume.'}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
