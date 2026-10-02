import { useState } from 'react';
import { 
  Briefcase, Plus, Search, Edit2, Trash2, 
  MapPin, DollarSign, Users, ChevronRight 
} from 'lucide-react';
import { StatusBadge } from '../common/Badge';

export function HrJobsView({ jobs, applications, onAddJob, onEditJob, onDeleteJob, onSelectJobForPipeline }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.location && job.location.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Job Openings Management</h2>
          <p className="text-xs text-slate-400 mt-1">
            Create and maintain published roles, monitor candidate traffic, and update hiring requirements.
          </p>
        </div>

        <button
          onClick={onAddJob}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/25 transition-all self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Publish New Job</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by role title, department, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Statuses</option>
          <option value="open">Active Openings</option>
          <option value="closed">Closed / Archived</option>
        </select>
      </div>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredJobs.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 text-xs bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl">
            No job postings found matching your search.
          </div>
        ) : (
          filteredJobs.map(job => {
            const count = applications.filter(a => a.jobId === job.id).length;

            return (
              <div
                key={job.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                      {job.department}
                    </span>
                    <StatusBadge status={job.status} />
                  </div>

                  <h3 className="text-base font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                    {job.title}
                  </h3>

                  <div className="space-y-1 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-slate-500" />
                      <span>{job.location || 'Remote'} • {job.type}</span>
                    </div>
                    {job.salaryRange && (
                      <div className="flex items-center gap-1.5">
                        <DollarSign size={12} className="text-emerald-400" />
                        <span className="text-emerald-400 font-medium">{job.salaryRange}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {job.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => onSelectJobForPipeline(job.id)}
                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    <Users size={14} />
                    <span>{count} Candidate{count === 1 ? '' : 's'}</span>
                    <ChevronRight size={12} />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onEditJob(job)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title="Edit Job"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteJob(job)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete Job"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
