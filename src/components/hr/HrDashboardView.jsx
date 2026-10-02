import { useState } from 'react';
import { 
  Users, Briefcase, Calendar, CheckCircle2, Clock, 
  ArrowRight, BrainCircuit, MessageSquare, ChevronRight, Plus, ExternalLink 
} from 'lucide-react';
import { StageBadge } from '../common/Badge';
import { PIPELINE_STAGES } from './CandidateProfileModal';

export function HrDashboardView({
  jobs,
  applications,
  onNavigate,
  onViewCandidate,
  onUpdateStage,
  onScreenCandidate,
  onAddJob
}) {
  const openJobsCount = jobs.filter(j => j.status === 'open').length;
  const interviewsCount = applications.filter(a => a.stage === 'Interview Scheduled' || a.interview).length;
  const offersCount = applications.filter(a => a.stage === 'Job Offer').length;
  const hiredCount = applications.filter(a => a.stage === 'Hired').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Top Welcome & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Recruitment & Pipeline Overview</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status of candidate applications, interview funnels, and automated status dispatches.
          </p>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={onAddJob}
            className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl shadow-lg shadow-indigo-600/25 transition-all"
          >
            <Plus size={15} />
            <span>Publish Job</span>
          </button>
          <button
            onClick={() => onNavigate('kanban')}
            className="flex items-center gap-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl border border-slate-700 transition-colors"
          >
            <span>Open Pipeline Board</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Active Openings"
          value={openJobsCount}
          subtitle={`${jobs.length} total roles`}
          icon={<Briefcase size={18} className="text-indigo-400" />}
          onClick={() => onNavigate('jobs')}
        />
        <StatCard
          title="Total Candidates"
          value={applications.length}
          subtitle="Across all pipelines"
          icon={<Users size={18} className="text-blue-400" />}
          onClick={() => onNavigate('kanban')}
        />
        <StatCard
          title="Interviews"
          value={interviewsCount}
          subtitle="Active / Scheduled"
          icon={<Calendar size={18} className="text-amber-400" />}
          onClick={() => onNavigate('kanban')}
        />
        <StatCard
          title="Offers Extended"
          value={offersCount}
          subtitle="Awaiting acceptance"
          icon={<Clock size={18} className="text-teal-400" />}
          onClick={() => onNavigate('kanban')}
        />
        <StatCard
          title="Candidates Hired"
          value={hiredCount}
          subtitle="Successful placements"
          icon={<CheckCircle2 size={18} className="text-emerald-400" />}
          onClick={() => onNavigate('kanban')}
        />
      </div>

      {/* Pipeline Funnel Distribution Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Candidate Pipeline Breakdown
          </h3>
          <span className="text-[11px] text-slate-500">
            {applications.length} total applicant profiles
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
          {PIPELINE_STAGES.map(stage => {
            const count = applications.filter(a => a.stage === stage).length;
            const pct = applications.length > 0 ? Math.round((count / applications.length) * 100) : 0;

            return (
              <div 
                key={stage}
                onClick={() => onNavigate('kanban')}
                className="bg-slate-950 p-3 rounded-xl border border-slate-800 hover:border-slate-700 cursor-pointer transition-all"
              >
                <div className="text-[11px] text-slate-400 truncate">{stage}</div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-bold text-slate-100">{count}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Applications Management Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100">Applicant Submissions & Lifecycle Status</h3>
            <p className="text-xs text-slate-400 mt-0.5">Manage and advance applicants with direct stage triggers</p>
          </div>
          <button
            onClick={() => onNavigate('kanban')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
          >
            <span>Full Kanban Pipeline</span>
            <ChevronRight size={13} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-5">Candidate Name</th>
                <th className="py-3.5 px-5">Applied Job Opening</th>
                <th className="py-3.5 px-5">Pipeline Stage</th>
                <th className="py-3.5 px-5">AI Qualification</th>
                <th className="py-3.5 px-5">Notes & Interview</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No candidate applications submitted yet.
                  </td>
                </tr>
              ) : (
                applications.slice(0, 10).map(app => {
                  const job = jobs.find(j => j.id === app.jobId);

                  return (
                    <tr 
                      key={app.id} 
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      onClick={() => onViewCandidate(app)}
                    >
                      <td className="py-4 px-5">
                        <div className="font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors">
                          {app.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{app.email}</div>
                      </td>

                      <td className="py-4 px-5">
                        <div className="font-medium text-slate-200 line-clamp-1">{job?.title || app.role}</div>
                        <div className="text-[10px] text-slate-500">{job?.department || 'General'}</div>
                      </td>

                      <td className="py-4 px-5" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={app.stage}
                          onChange={(e) => onUpdateStage(app.id, e.target.value)}
                          className="bg-slate-950 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          {PIPELINE_STAGES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>

                      <td className="py-4 px-5">
                        {app.geminiScore !== null && app.geminiScore !== undefined ? (
                          <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded ${
                            app.geminiScore >= 80 ? 'text-emerald-400 bg-emerald-500/10' :
                            app.geminiScore >= 60 ? 'text-amber-400 bg-amber-500/10' :
                            'text-rose-400 bg-rose-500/10'
                          }`}>
                            <BrainCircuit size={12} /> {app.geminiScore}/100
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">Pending review</span>
                        )}
                      </td>

                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          {app.interview ? (
                            <span className="text-[11px] text-amber-300 flex items-center gap-1">
                              <Calendar size={12} /> Scheduled
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-600">—</span>
                          )}
                          {app.recruiterNotes && (
                            <span className="text-[11px] text-indigo-300 flex items-center gap-1" title={app.recruiterNotes}>
                              <MessageSquare size={12} /> Notes
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onViewCandidate(app)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function StatCard({ title, value, subtitle, icon, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl cursor-pointer transition-all hover:shadow-lg group"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400">{title}</span>
        <div className="p-2 rounded-xl bg-slate-800/80 group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <div className="text-2xl font-extrabold text-slate-100">{value}</div>
      <div className="text-[10px] text-slate-500 mt-1">{subtitle}</div>
    </div>
  );
}
