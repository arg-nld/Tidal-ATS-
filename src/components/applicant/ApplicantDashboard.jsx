import { useState } from 'react';
import { api } from '../../services/api';
import { 
  Briefcase, Calendar, Clock, Video, CheckCircle, 
  ExternalLink, Mail, AlertCircle, Sparkles, RefreshCw, ChevronRight,
  FileCheck, CheckCircle2, XCircle, DollarSign, X, Send
} from 'lucide-react';
import { StageBadge } from '../common/Badge';
import { Spinner } from '../common/Spinner';
import { PIPELINE_STAGES } from '../../constants/pipeline';

// Visual Pipeline Steps for the applicant
const TRACKER_STAGES = [
  'Application Submitted',
  'Initial Screening',
  'Shortlisted',
  'Interview Scheduled',
  'Job Offer',
  'Hired'
];

export function ApplicantDashboard({ applications, onRefresh, onExploreJobs }) {
  const [selectedAppEmails, setSelectedAppEmails] = useState(null);
  const [offerModal, setOfferModal] = useState({
    isOpen: false,
    app: null,
    action: null, // 'accepted' | 'declined'
    comment: '',
    isSubmitting: false
  });

  const handleOfferResponse = async () => {
    if (!offerModal.app || !offerModal.action) return;
    setOfferModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      await api.applications.respondToOffer(offerModal.app.id, {
        response: offerModal.action,
        comment: offerModal.comment
      });
      setOfferModal({ isOpen: false, app: null, action: null, comment: '', isSubmitting: false });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Failed to submit offer response: ${err.message}`);
      setOfferModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const getStageIndex = (stage) => {
    if (stage === 'Rejected') return -1;
    return TRACKER_STAGES.indexOf(stage);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900/70 border border-slate-800 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">My Applications & Status</h2>
          <p className="text-sm text-slate-400 mt-1">
            Real-time tracking of your job submissions, interview schedules, and hiring milestones.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 px-3.5 py-2 rounded-xl border border-slate-700 transition-colors"
          >
            <RefreshCw size={13} />
            <span>Check Updates</span>
          </button>
          <button
            onClick={onExploreJobs}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Briefcase size={14} />
            <span>Browse More Roles</span>
          </button>
        </div>
      </div>

      {/* Applications List */}
      {applications.length === 0 ? (
        <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
            <Briefcase size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-200">No Applications Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You haven't submitted any job applications yet. Explore our open positions and submit your profile today.
            </p>
          </div>
          <button
            onClick={onExploreJobs}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition-all inline-flex items-center gap-2"
          >
            Browse Open Jobs <ChevronRight size={14} />
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {applications.map(app => {
            const currentIdx = getStageIndex(app.stage);
            const isRejected = app.stage === 'Rejected';

            return (
              <div
                key={app.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6 transition-all hover:border-slate-700"
              >
                {/* Header: Role info & current status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                      </span>
                      <span className="text-xs text-slate-500">• Applied {new Date(app.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-100">{app.job?.title || app.role}</h3>
                    <p className="text-xs text-slate-400">
                      {app.job?.location || 'Remote'} • {app.job?.type || 'Full-time'}
                      {app.job?.salaryRange && <span className="text-emerald-400 font-medium ml-2">{app.job.salaryRange}</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Current Stage</div>
                      <div className="mt-1">
                        <StageBadge stage={app.stage} size="md" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pipeline Progression Stepper */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={13} className="text-indigo-400" />
                    <span>Hiring Pipeline Progress</span>
                  </div>

                  {isRejected ? (
                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span>Application Status: Position Filled / Application Archived</span>
                      </div>
                      <span className="text-[11px] text-rose-400">An update email has been sent to your inbox.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
                      {TRACKER_STAGES.map((stageName, idx) => {
                        const isCompleted = currentIdx > idx;
                        const isCurrent = currentIdx === idx;

                        return (
                          <div
                            key={stageName}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              isCurrent
                                ? 'bg-indigo-600/15 border-indigo-500 shadow-lg shadow-indigo-600/10'
                                : isCompleted
                                ? 'bg-slate-950/80 border-emerald-500/30 text-slate-300'
                                : 'bg-slate-950/40 border-slate-800/80 text-slate-600'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-mono font-bold text-slate-500">
                                0{idx + 1}
                              </span>
                              {isCompleted ? (
                                <CheckCircle size={14} className="text-emerald-400" />
                              ) : isCurrent ? (
                                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                              )}
                            </div>
                            <div className={`text-xs font-semibold leading-tight ${
                              isCurrent ? 'text-indigo-200' : isCompleted ? 'text-slate-200' : 'text-slate-500'
                            }`}>
                              {stageName}
                            </div>
                            <div className="text-[10px] mt-1 text-slate-500">
                              {isCompleted ? 'Completed' : isCurrent ? 'Active Stage' : 'Upcoming'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Conditional Interview Scheduled Alert Card */}
                {app.interview && (
                  <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                        <Calendar size={18} />
                        <span>Scheduled Interview Session</span>
                      </div>
                      <span className="text-[11px] font-semibold text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                        {app.interview.type || 'Technical Round'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-slate-500 block">Date & Time:</span>
                        <span className="font-semibold text-slate-200">
                          {new Date(app.interview.scheduledAt).toLocaleString('en-US', {
                            dateStyle: 'full',
                            timeStyle: 'short'
                          })}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-slate-500 block">Interview Panel:</span>
                        <span className="font-semibold text-slate-200">{app.interview.interviewer}</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-slate-500 block">Meeting Access:</span>
                        {app.interview.meetingLink ? (
                          <a
                            href={app.interview.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-semibold"
                          >
                            <Video size={13} /> Join Virtual Room <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-slate-400">Link in email invite</span>
                        )}
                      </div>
                    </div>

                    {app.interview.notes && (
                      <div className="pt-2 text-xs text-slate-400 border-t border-amber-500/20">
                        <span className="text-slate-300 font-medium">Preparation Notes: </span>
                        {app.interview.notes}
                      </div>
                    )}
                  </div>
                )}

                {/* Formal Job Offer Card */}
                {(app.offer || app.stage === 'Job Offer' || app.stage === 'Hired') && (
                  <div className={`rounded-2xl p-5 space-y-4 border ${
                    app.offer?.status === 'accepted' || app.stage === 'Hired'
                      ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                      : app.offer?.status === 'declined'
                      ? 'bg-rose-950/20 border-rose-500/20 text-rose-200'
                      : 'bg-gradient-to-r from-teal-500/15 via-emerald-500/10 to-transparent border-teal-500/40 text-slate-200'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <FileCheck size={20} className={
                          app.offer?.status === 'accepted' || app.stage === 'Hired'
                            ? 'text-emerald-400'
                            : app.offer?.status === 'declined'
                            ? 'text-rose-400'
                            : 'text-teal-400'
                        } />
                        <h4 className="text-sm font-bold text-white">
                          {app.offer?.status === 'accepted' || app.stage === 'Hired'
                            ? 'Official Job Offer — Accepted 🎉'
                            : app.offer?.status === 'declined'
                            ? 'Official Job Offer — Declined'
                            : app.offer?.status === 'sent'
                            ? 'Official Job Offer Received — Action Required'
                            : 'Formal Job Offer Extended!'}
                        </h4>
                      </div>

                      {app.offer?.status && (
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border font-mono uppercase tracking-wider ${
                          app.offer.status === 'accepted' || app.stage === 'Hired'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : app.offer.status === 'declined'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-teal-500/20 text-teal-300 border-teal-500/40 animate-pulse'
                        }`}>
                          {app.offer.status}
                        </span>
                      )}
                    </div>

                    {app.offer?.compensation ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Proposed Compensation</span>
                          <span className="text-base font-extrabold text-emerald-400 mt-0.5 block">
                            {app.offer.compensation.currency || '₱'}{Number(app.offer.compensation.amount || 0).toLocaleString()} <span className="text-xs text-slate-400 font-normal">{app.offer.compensation.period || '/ month'}</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Target Start Date</span>
                          <span className="text-xs font-semibold text-slate-200 mt-1 block">
                            {app.offer.proposedStartDate ? new Date(app.offer.proposedStartDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Flexible'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Offer Expiry</span>
                          <span className="text-xs font-semibold text-slate-200 mt-1 block">
                            {app.offer.expiryDate ? new Date(app.offer.expiryDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Open'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Congratulations! Tidal Nexus has officially extended a conditional job offer for this position. Our talent acquisition lead will contact you to discuss compensation and welcome you to the team.
                      </p>
                    )}

                    {app.offer?.notes && (
                      <div className="text-xs text-slate-300 bg-slate-900/40 p-3 rounded-xl border border-slate-800/60 leading-relaxed">
                        <strong className="text-slate-200 block mb-0.5">Offer Summary & Terms:</strong>
                        {app.offer.notes}
                      </div>
                    )}

                    {/* Action buttons if offer status is 'sent' */}
                    {app.offer?.status === 'sent' && (
                      <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5 border-t border-teal-500/20">
                        <button
                          type="button"
                          onClick={() => setOfferModal({
                            isOpen: true,
                            app,
                            action: 'declined',
                            comment: '',
                            isSubmitting: false
                          })}
                          className="w-full sm:w-auto px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                        >
                          Decline Offer
                        </button>
                        <button
                          type="button"
                          onClick={() => setOfferModal({
                            isOpen: true,
                            app,
                            action: 'accepted',
                            comment: '',
                            isSubmitting: false
                          })}
                          className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 size={14} /> Accept Job Offer
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer with resume details and email info */}
                <div className="pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span>Candidate: <strong className="text-slate-300">{app.name}</strong></span>
                    <span>•</span>
                    <span>Email: <span className="font-mono text-slate-400">{app.email}</span></span>
                    {app.fileName && (
                      <>
                        <span>•</span>
                        <span>Attached: <span className="text-slate-300">{app.fileName}</span></span>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] text-indigo-400">
                    Real-time status updates sync directly with HR
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Candidate Offer Response Modal */}
      {offerModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {offerModal.action === 'accepted' ? (
                  <><CheckCircle2 size={18} className="text-emerald-400" /> Accept Job Offer</>
                ) : (
                  <><XCircle size={18} className="text-rose-400" /> Decline Job Offer</>
                )}
              </h3>
              <button
                onClick={() => setOfferModal({ isOpen: false, app: null, action: null, comment: '', isSubmitting: false })}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              {offerModal.action === 'accepted'
                ? `You are about to formally accept the job offer for ${offerModal.app?.job?.title || offerModal.app?.role}. This will notify the HR talent team and transition your application to Hired!`
                : `Are you sure you wish to decline the offer for ${offerModal.app?.job?.title || offerModal.app?.role}? This decision cannot be reversed without contacting HR directly.`}
            </p>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Optional note to hiring team:
              </label>
              <textarea
                rows={3}
                value={offerModal.comment}
                onChange={e => setOfferModal(p => ({ ...p, comment: e.target.value }))}
                placeholder={offerModal.action === 'accepted' ? "Excited to join the team!" : "Reason for declining (optional)"}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setOfferModal({ isOpen: false, app: null, action: null, comment: '', isSubmitting: false })}
                disabled={offerModal.isSubmitting}
                className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOfferResponse}
                disabled={offerModal.isSubmitting}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 cursor-pointer ${
                  offerModal.action === 'accepted'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {offerModal.isSubmitting ? <Spinner className="w-3.5 h-3.5" /> : <Send size={13} />}
                {offerModal.isSubmitting ? 'Submitting...' : offerModal.action === 'accepted' ? 'Confirm Acceptance' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
