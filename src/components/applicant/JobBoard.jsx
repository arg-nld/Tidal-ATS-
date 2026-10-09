import { useState } from 'react';
import { Briefcase, MapPin, DollarSign, Clock, Search, ChevronRight, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../common/Badge';

export function JobBoard({ jobs, appliedJobIds, onApply }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHub, setSelectedHub] = useState('All');
  const [viewingJob, setViewingJob] = useState(null);

  const PHILIPPINE_HUBS = [
    'All',
    'BGC Taguig',
    'Makati City',
    'Ortigas Pasig',
    'Eastwood / QC',
    'Cebu IT Park',
    'Clark / Pampanga',
    'Remote - Philippines'
  ];

  const formatPhpSalary = (range) => {
    if (!range) return null;
    const trimmed = String(range).trim();
    if (trimmed.startsWith('₱') || trimmed.toUpperCase().includes('PHP')) return trimmed;
    // If it has USD or $, convert display symbol or suffix to PHP
    if (trimmed.includes('$')) {
      return trimmed.replace('$', '₱').replace(/USD/gi, 'PHP');
    }
    return `₱${trimmed}`;
  };

  const filteredJobs = jobs.filter(job => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      job.title.toLowerCase().includes(term) ||
      (job.description && job.description.toLowerCase().includes(term)) ||
      (job.location && job.location.toLowerCase().includes(term));

    const matchesHub = selectedHub === 'All' || (() => {
      const loc = (job.location || '').toLowerCase();
      if (selectedHub === 'BGC Taguig') return loc.includes('bgc') || loc.includes('taguig');
      if (selectedHub === 'Makati City') return loc.includes('makati');
      if (selectedHub === 'Ortigas Pasig') return loc.includes('ortigas') || loc.includes('pasig');
      if (selectedHub === 'Eastwood / QC') return loc.includes('eastwood') || loc.includes('quezon') || loc.includes('qc');
      if (selectedHub === 'Cebu IT Park') return loc.includes('cebu');
      if (selectedHub === 'Clark / Pampanga') return loc.includes('clark') || loc.includes('pampanga');
      if (selectedHub === 'Remote - Philippines') return loc.includes('remote') || loc.includes('philippines');
      return loc.includes(selectedHub.toLowerCase());
    })();

    return matchesSearch && matchesHub;
  });

  return (
    <div className="space-y-6">
      
      {/* Header and Search Filters */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-5">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
            <span>🇵🇭 Philippine Careers & Tech Hotspots</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-100">Explore Open Opportunities</h2>
          <p className="text-sm text-slate-400 mt-1">
            Discover roles across Metro Manila, Cebu IT Park, Clark, and remote hubs in the Philippines.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search by role title, technology, or location (e.g. BGC, React, Fintech)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Hotspot Location Quick Filter Pills */}
        <div className="pt-2 border-t border-slate-800/60">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MapPin size={12} className="text-indigo-400" /> Top Philippine Hotspots:
          </div>
          <div className="flex flex-wrap gap-2">
            {PHILIPPINE_HUBS.map(hub => {
              const active = selectedHub === hub;
              return (
                <button
                  key={hub}
                  type="button"
                  onClick={() => setSelectedHub(hub)}
                  className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all ${
                    active
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 border border-indigo-500'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {hub === 'All' ? '📍 All Hotspots' : hub}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredJobs.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 text-sm bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl">
            No active positions found matching your criteria.
          </div>
        ) : (
          filteredJobs.map(job => {
            const hasApplied = appliedJobIds.includes(job.id);

            return (
              <div
                key={job.id}
                className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 flex flex-col justify-between transition-all hover:shadow-xl hover:shadow-indigo-950/20 group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-end gap-2">
                    <StatusBadge status={job.status} />
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors leading-snug">
                      {job.title}
                    </h3>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="text-slate-500" />
                      <span>{job.location || 'Remote'}</span>
                    </div>
                    {job.salaryRange && (
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-emerald-400">₱</span>
                        <span className="text-emerald-400/90 font-medium">{formatPhpSalary(job.salaryRange)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Briefcase size={13} className="text-slate-500" />
                      <span>{job.type || 'Full-time'} • {job.experienceLevel || 'Mid-Senior'}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed pt-1">
                    {job.description}
                  </p>
                </div>

                <div className="pt-5 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => setViewingJob(job)}
                    className="text-xs text-slate-400 hover:text-slate-200 font-medium"
                  >
                    View Details
                  </button>

                  {hasApplied ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                      <CheckCircle2 size={14} /> Applied
                    </span>
                  ) : (
                    <button
                      onClick={() => onApply(job)}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl shadow-md shadow-indigo-600/20 transition-all"
                    >
                      Apply Now <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Job Details Modal */}
      {viewingJob && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-slate-100 mt-1">{viewingJob.title}</h2>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
                  <span>{viewingJob.location}</span>
                  <span>•</span>
                  <span>{viewingJob.type}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-medium">{formatPhpSalary(viewingJob.salaryRange)}</span>
                </div>
              </div>
              <button 
                onClick={() => setViewingJob(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 text-sm text-slate-300 whitespace-pre-line leading-relaxed">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Job Description & Requirements</h4>
              {viewingJob.description}
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/90">
              <button
                onClick={() => setViewingJob(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
              {appliedJobIds.includes(viewingJob.id) ? (
                <span className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Already Applied
                </span>
              ) : (
                <button
                  onClick={() => {
                    const targetJob = viewingJob;
                    setViewingJob(null);
                    onApply(targetJob);
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all"
                >
                  Apply for this Role
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
