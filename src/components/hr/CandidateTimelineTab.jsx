import { 
  Clock, CheckCircle2, User, Sparkles, Calendar, Award, 
  FileCheck, Mail, Send, XCircle, AlertCircle, GitMerge, FileText
} from 'lucide-react';

const EVENT_CONFIG = {
  application_submitted: { icon: FileText, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  screening_completed: { icon: Sparkles, color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  stage_changed: { icon: CheckCircle2, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  interview_scheduled: { icon: Calendar, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  scorecard_submitted: { icon: Award, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  offer_created: { icon: FileCheck, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  offer_revised: { icon: FileCheck, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  offer_approved: { icon: CheckCircle2, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  offer_sent: { icon: Send, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  offer_accepted: { icon: Award, color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' },
  offer_declined: { icon: XCircle, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  offer_withdrawn: { icon: AlertCircle, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  candidate_merged: { icon: GitMerge, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  notes_updated: { icon: FileText, color: 'text-slate-400 bg-slate-800 border-slate-700' }
};

export function CandidateTimelineTab({ candidate: propCandidate, application }) {
  const candidate = propCandidate || application || {};
  const timeline = Array.isArray(candidate.timeline) ? [...candidate.timeline] : [];
  timeline.sort((a, b) => b.timestamp - a.timestamp); // Most recent first

  return (
    <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Clock size={16} className="text-indigo-400" />
            Candidate Activity Timeline
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Chronological audit trail of all candidate interactions and stage updates</p>
        </div>
        <span className="text-[11px] font-mono bg-slate-900 text-slate-400 px-2 py-1 rounded-lg border border-slate-800">
          {timeline.length} Recorded Events
        </span>
      </div>

      {timeline.length > 0 ? (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
          {timeline.map((event, idx) => {
            const config = EVENT_CONFIG[event.type] || { icon: Clock, color: 'text-slate-400 bg-slate-800 border-slate-700' };
            const Icon = config.icon;
            const date = new Date(event.timestamp);

            return (
              <div key={event.id || idx} className="relative group">
                {/* Timeline node icon */}
                <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full border flex items-center justify-center ${config.color} shadow-sm ring-4 ring-slate-950`}>
                  <Icon size={11} />
                </div>

                {/* Event content card */}
                <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3.5 space-y-1.5 transition-all group-hover:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-200">{event.title}</h4>
                    <span className="text-[10px] font-mono text-slate-500">
                      {date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {event.description && (
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {event.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500">
                    <User size={10} className="text-slate-400" />
                    <span>Action performed by: <span className="text-slate-400 font-semibold">{event.performedBy}</span></span>
                    {event.performedByRole && (
                      <span className="bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded text-[9px] uppercase font-bold">
                        {event.performedByRole}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-xs text-slate-500">
          No timeline events recorded yet.
        </div>
      )}
    </div>
  );
}
