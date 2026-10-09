import { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { 
  BarChart3, TrendingUp, Clock, Users, ArrowUpRight, ArrowDownRight,
  Filter, Download, Printer, CheckCircle2, AlertTriangle, AlertCircle,
  Briefcase, Calendar, ChevronRight, X, ExternalLink, Sparkles, DollarSign,
  Layers, Check, FileSpreadsheet
} from 'lucide-react';
import { Spinner } from '../common/Spinner';

export function HrAnalyticsView({ jobs = [], onSelectCandidate }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  // Filters
  const [dateRange, setDateRange] = useState('all'); // 'all' | '30d' | '90d' | 'year'
  const [selectedJobId, setSelectedJobId] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRecruiter, setSelectedRecruiter] = useState('all');

  // Drilldown modal
  const [drilldownModal, setDrilldownModal] = useState({
    isOpen: false,
    title: '',
    candidateIds: [],
    candidates: []
  });

  const [allApplications, setAllApplications] = useState([]);

  const computeDateRangeParams = (range) => {
    if (range === 'all') return {};
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    const start = new Date();
    if (range === '30d') start.setDate(now.getDate() - 30);
    else if (range === '90d') start.setDate(now.getDate() - 90);
    else if (range === 'year') start.setFullYear(now.getFullYear(), 0, 1);
    return { startDate: start.toISOString().slice(0, 10), endDate: end };
  };

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const dateParams = computeDateRangeParams(dateRange);
      const params = {
        ...dateParams,
        jobId: selectedJobId,
        source: selectedSource,
        status: selectedStatus,
        recruiter: selectedRecruiter
      };
      const [analyticsRes, appsRes] = await Promise.all([
        api.analytics.get(params),
        api.applications.getAll()
      ]);
      setAnalyticsData(analyticsRes);
      setAllApplications(appsRes.applications || []);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(err.message || 'Failed to load recruitment analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [dateRange, selectedJobId, selectedSource, selectedStatus, selectedRecruiter]);

  const handleExportCsv = () => {
    const dateParams = computeDateRangeParams(dateRange);
    const params = {
      ...dateParams,
      jobId: selectedJobId,
      source: selectedSource,
      status: selectedStatus,
      recruiter: selectedRecruiter
    };
    const url = api.analytics.downloadCsvUrl(params);
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const openDrilldown = (stageName, candidateIds) => {
    const matched = allApplications.filter(a => candidateIds.includes(a.id));
    setDrilldownModal({
      isOpen: true,
      title: `${stageName} Candidates (${matched.length})`,
      candidateIds,
      candidates: matched
    });
  };

  const summary = analyticsData?.summary || {
    totalApplications: 0,
    totalHires: 0,
    avgTimeToHire: 0,
    medianTimeToHire: 0,
    avgTimeToFill: 0,
    offerAcceptanceRate: 0,
    stalledCount: 0,
    overdueEvaluationsCount: 0
  };

  const funnel = analyticsData?.funnel || [];
  const speed = analyticsData?.speed || {};
  const sources = analyticsData?.sources || [];
  const rejectionReasons = analyticsData?.rejectionReasons || [];

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 p-6 space-y-6">
      
      {/* Header and Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <BarChart3 size={18} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">Recruitment Analytics & Reports</h1>
              <p className="text-xs text-slate-400">Real-time funnel conversion, hiring velocity, and sourcing performance</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-2 transition-all hover:bg-slate-800"
            title="Download CSV Report"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20"
            title="Print or Save as PDF"
          >
            <Printer size={14} />
            <span>Printable Report</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center gap-3 print:hidden">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mr-2">
          <Filter size={14} className="text-indigo-400" />
          <span>Filters:</span>
        </div>

        {/* Date Range Selector */}
        <select
          value={dateRange}
          onChange={e => setDateRange(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Time</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
          <option value="year">This Year</option>
        </select>

        {/* Job Opening Selector */}
        <select
          value={selectedJobId}
          onChange={e => setSelectedJobId(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 max-w-[220px] truncate"
        >
          <option value="all">All Jobs ({jobs.length})</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>{j.title}</option>
          ))}
        </select>

        {/* Sourcing Channel Selector */}
        <select
          value={selectedSource}
          onChange={e => setSelectedSource(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Sourcing Channels</option>
          <option value="LinkedIn">LinkedIn</option>
          <option value="Indeed">Indeed</option>
          <option value="Company Careers">Company Careers</option>
          <option value="Employee Referral">Employee Referral</option>
          <option value="Direct Application">Direct Application</option>
          <option value="GitHub / Portfolio">GitHub / Portfolio</option>
          <option value="Other">Other</option>
        </select>

        {/* Pipeline Status Selector */}
        <select
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Stages</option>
          <option value="Application Submitted">Application Submitted</option>
          <option value="Initial Screening">Initial Screening</option>
          <option value="Shortlisted">Shortlisted</option>
          <option value="Interview Scheduled">Interview Scheduled</option>
          <option value="Job Offer">Job Offer</option>
          <option value="Hired">Hired</option>
          <option value="Rejected">Rejected</option>
        </select>

        {(dateRange !== 'all' || selectedJobId !== 'all' || selectedSource !== 'all' || selectedStatus !== 'all') && (
          <button
            onClick={() => {
              setDateRange('all');
              setSelectedJobId('all');
              setSelectedSource('all');
              setSelectedStatus('all');
              setSelectedRecruiter('all');
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300 ml-auto flex items-center gap-1 font-semibold"
          >
            <X size={12} /> Reset Filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-24 text-center bg-slate-900 rounded-2xl border border-slate-800 space-y-3">
          <Spinner className="w-8 h-8 text-indigo-400 mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Computing recruitment metrics from database...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : (
        <>
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Total Applications</span>
              <div className="text-2xl font-black text-slate-100">{summary.totalApplications}</div>
              <span className="text-[10px] text-slate-400">In selected scope</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Total Hires</span>
              <div className="text-2xl font-black text-emerald-400">{summary.totalHires}</div>
              <span className="text-[10px] text-emerald-400/80">Successful placements</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Avg Time to Hire</span>
              <div className="text-2xl font-black text-indigo-400">
                {summary.avgTimeToHire > 0 ? `${summary.avgTimeToHire}d` : '—'}
              </div>
              <span className="text-[10px] text-slate-400">Median: {summary.medianTimeToHire || '—'} days</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Avg Time to Fill</span>
              <div className="text-2xl font-black text-violet-400">
                {summary.avgTimeToFill > 0 ? `${summary.avgTimeToFill}d` : '—'}
              </div>
              <span className="text-[10px] text-slate-400">Per open job role</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Offer Acceptance</span>
              <div className="text-2xl font-black text-amber-400">
                {summary.offerAcceptanceRate}%
              </div>
              <span className="text-[10px] text-slate-400">Offered vs Hired</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Attention Needed</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-rose-400">
                  {summary.stalledCount + summary.overdueEvaluationsCount}
                </span>
                {summary.stalledCount > 0 && (
                  <span className="text-[10px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/20">
                    {summary.stalledCount} stalled
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400">{summary.overdueEvaluationsCount} overdue evaluations</span>
            </div>
          </div>

          {/* Section A: Recruitment Funnel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <TrendingUp size={16} className="text-indigo-400" />
                  Recruitment Funnel & Drop-off Analysis
                </h2>
                <p className="text-xs text-slate-400">Click any stage bar to drill down into the matching candidates</p>
              </div>
              <span className="text-[11px] text-slate-500">Interactive Drilldown</span>
            </div>

            {/* Funnel Progress Bars */}
            <div className="space-y-3">
              {funnel.map((step, idx) => {
                const maxCount = Math.max(1, funnel[0]?.count || 1);
                const widthPercent = Math.max(8, Math.round((step.count / maxCount) * 100));
                const colors = [
                  'from-slate-700 to-slate-600',
                  'from-blue-600 to-indigo-600',
                  'from-indigo-600 to-violet-600',
                  'from-violet-600 to-purple-600',
                  'from-purple-600 to-pink-600',
                  'from-emerald-600 to-teal-500'
                ];

                return (
                  <div key={step.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-[11px] font-mono text-slate-500">{idx + 1}.</span>
                        <span className="font-semibold text-slate-200">{step.stage}</span>
                        {idx > 0 && (
                          <span className="text-[11px] text-slate-400">
                            (Conv: <span className="text-indigo-400 font-bold">{step.conversionFromPrev}%</span>)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        {step.dropOffCount > 0 && (
                          <span className="text-[11px] text-rose-400 font-medium">
                            -{step.dropOffCount} dropped ({step.dropOffRate}%)
                          </span>
                        )}
                        <span className="font-bold text-slate-100 font-mono text-sm">{step.count} candidates</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openDrilldown(step.stage, step.candidateIds)}
                      className="w-full text-left bg-slate-950/60 rounded-xl p-1 hover:bg-slate-800/50 transition-colors group relative"
                      title={`Click to view ${step.count} candidates in ${step.stage}`}
                    >
                      <div
                        className={`h-7 rounded-lg bg-gradient-to-r ${colors[idx % colors.length]} flex items-center justify-between px-3 text-white text-[11px] font-semibold transition-all group-hover:brightness-110 shadow-sm`}
                        style={{ width: `${widthPercent}%` }}
                      >
                        <span className="truncate">{step.overallConversion}% of total</span>
                        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0" />
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Rejection Reasons Breakdown */}
            {rejectionReasons.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-800 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Primary Rejection / Drop-off Reasons
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {rejectionReasons.slice(0, 6).map(r => (
                    <div key={r.reason} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                      <span className="text-slate-300 truncate pr-2" title={r.reason}>{r.reason}</span>
                      <span className="font-mono font-bold text-rose-400 shrink-0">
                        {r.count} <span className="text-[10px] text-slate-500 font-normal">({r.percentage}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section B: Recruitment Speed & Bottlenecks */}
          <div className="grid lg:grid-cols-2 gap-5">
            
            {/* Stage Duration Breakdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Clock size={16} className="text-indigo-400" />
                  Average Time Spent in Each Stage
                </h2>
                <span className="text-[11px] text-slate-500">Stage Velocity</span>
              </div>

              <div className="space-y-3">
                {speed.averageStageDurations?.map(sd => (
                  <div key={sd.stage} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{sd.stage}</span>
                      <span className="font-bold text-indigo-300 font-mono">{sd.averageDays} days avg</span>
                    </div>
                    <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.max(5, (sd.averageDays / 15) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Time to fill per job table */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time to Fill By Job Role</h3>
                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                  {speed.timeToFillByJob?.map(j => (
                    <div key={j.jobId} className="flex items-center justify-between p-2 rounded-xl bg-slate-950 text-xs">
                      <div className="truncate pr-2">
                        <span className="font-semibold text-slate-200 block truncate">{j.jobTitle}</span>
                        <span className="text-[10px] text-slate-500">{j.department} • {j.hiresCount} hires</span>
                      </div>
                      <span className={`font-mono text-xs font-bold shrink-0 ${j.isFilled ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {j.daysToFill} days {j.isFilled ? '(filled)' : '(open)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pipeline Bottlenecks: Stalled & Overdue */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-rose-400" />
                  Bottlenecks & Overdue Actions
                </h2>
                <span className="text-[11px] text-slate-500">&gt;14d Inactivity</span>
              </div>

              {/* Stalled Applications */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">Stalled Applications ({speed.stalledApplications?.length || 0})</span>
                  <span className="text-[10px] text-slate-500">No activity in 14+ days</span>
                </div>
                {speed.stalledApplications?.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                    {speed.stalledApplications.map(st => (
                      <div
                        key={st.id}
                        onClick={() => onSelectCandidate?.(st.id)}
                        className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 cursor-pointer border border-slate-800/80 flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <span className="font-semibold text-slate-200 block">{st.name}</span>
                          <span className="text-[10px] text-slate-500">{st.jobTitle} • {st.stage}</span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          {st.daysInactive}d stalled
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                    ✓ No stalled applications found! Candidate pipeline is moving smoothly.
                  </p>
                )}
              </div>

              {/* Overdue Evaluations */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">Overdue Interview Evaluations ({speed.overdueEvaluations?.length || 0})</span>
                  <span className="text-[10px] text-slate-500">Interviews without scorecard</span>
                </div>
                {speed.overdueEvaluations?.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                    {speed.overdueEvaluations.map(ov => (
                      <div
                        key={ov.id}
                        onClick={() => onSelectCandidate?.(ov.id)}
                        className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 cursor-pointer border border-slate-800/80 flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <span className="font-semibold text-slate-200 block">{ov.name}</span>
                          <span className="text-[10px] text-slate-500">Interviewer: {ov.interviewer}</span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {ov.daysOverdue}d overdue
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                    ✓ All completed interviews have scorecards recorded!
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section C: Sourcing Channel Effectiveness */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Briefcase size={16} className="text-indigo-400" />
                  Recruitment Source Channel Effectiveness
                </h2>
                <p className="text-xs text-slate-400">Applications, qualification rates, offer conversion, and cost per hire</p>
              </div>
              <span className="text-[11px] text-slate-500">ROI & Channel Metrics</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase font-bold text-slate-400">
                    <th className="py-2.5 px-3">Sourcing Channel</th>
                    <th className="py-2.5 px-3">Applications</th>
                    <th className="py-2.5 px-3">Qualified %</th>
                    <th className="py-2.5 px-3">Interviewed</th>
                    <th className="py-2.5 px-3">Offered</th>
                    <th className="py-2.5 px-3">Hired</th>
                    <th className="py-2.5 px-3">Hire Conv. %</th>
                    <th className="py-2.5 px-3">Avg Time to Hire</th>
                    <th className="py-2.5 px-3">Cost per Hire</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sources.map(src => (
                    <tr key={src.source} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-200 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                        <span>{src.source}</span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-100">{src.applications}</td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-slate-300">{src.qualified}</span>
                        <span className="text-[10px] text-indigo-400 ml-1">({src.qualifiedRate}%)</span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">{src.interviews}</td>
                      <td className="py-3 px-3 font-mono text-slate-300">{src.offers}</td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400">{src.hires}</td>
                      <td className="py-3 px-3">
                        <span className={`font-mono font-bold ${src.hireRate > 15 ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {src.hireRate}%
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {src.avgTimeToHire > 0 ? `${src.avgTimeToHire}d` : '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {src.costPerHire != null ? `₱${src.costPerHire.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                  {sources.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-500">
                        No sourcing data matching the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Drilldown Modal: Clickable Funnel Stage Candidates */}
      {drilldownModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Users size={16} className="text-indigo-400" />
                  {drilldownModal.title}
                </h3>
                <p className="text-[11px] text-slate-400">Click any candidate to open their full profile and scorecard</p>
              </div>
              <button
                onClick={() => setDrilldownModal({ isOpen: false, title: '', candidateIds: [], candidates: [] })}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
              {drilldownModal.candidates.length > 0 ? (
                drilldownModal.candidates.map(cand => (
                  <div
                    key={cand.id}
                    onClick={() => {
                      setDrilldownModal({ isOpen: false, title: '', candidateIds: [], candidates: [] });
                      onSelectCandidate?.(cand.id);
                    }}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 cursor-pointer flex items-center justify-between transition-colors group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-200 group-hover:text-indigo-300">{cand.name}</span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                          {cand.stage}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{cand.email} • {cand.role}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {cand.geminiScore != null && (
                        <div className={`text-xs font-bold font-mono ${cand.geminiScore >= 80 ? 'text-emerald-400' : cand.geminiScore >= 60 ? 'text-amber-400' : 'text-slate-400'}`}>
                          {cand.geminiScore} <span className="text-[9px] font-normal text-slate-500">score</span>
                        </div>
                      )}
                      <ChevronRight size={14} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-10 text-xs text-slate-500">No candidate records found for this stage.</p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
