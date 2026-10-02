import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { JobBoard } from './JobBoard';
import { ApplicationModal } from './ApplicationModal';
import { ApplicantDashboard } from './ApplicantDashboard';
import { Briefcase, LayoutDashboard, Sparkles, AlertCircle } from 'lucide-react';
import { Spinner } from '../common/Spinner';

export function ApplicantPortal() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'jobs'
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applyingJob, setApplyingJob] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, appsRes] = await Promise.all([
        api.jobs.getAll({ status: 'open' }),
        api.applications.getAll()
      ]);
      setJobs(jobsRes.jobs || []);
      setApplications(appsRes.applications || []);
      // If user has applications, default to dashboard; otherwise prompt jobs
      if ((appsRes.applications || []).length === 0) {
        setActiveTab('jobs');
      }
    } catch (err) {
      console.error('Failed to load applicant data:', err);
      setError(err.message || 'Failed to load applicant data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);



  const appliedJobIds = applications.map(a => a.jobId);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard size={15} />
            <span>My Applications</span>
            {applications.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'dashboard' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-800 text-slate-300'
              }`}>
                {applications.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('jobs')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'jobs'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Briefcase size={15} />
            <span>Explore Open Jobs</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'jobs' ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-800 text-slate-300'
            }`}>
              {jobs.length}
            </span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
          <span>Signed in:</span>
          <span className="font-semibold text-slate-200">{user?.name}</span>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            Candidate
          </span>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
          <button onClick={loadData} className="underline hover:text-white">Retry</button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Spinner className="w-8 h-8 text-indigo-500" />
          <p className="text-xs text-slate-400">Loading your candidate workspace...</p>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <ApplicantDashboard
              applications={applications}
              onRefresh={loadData}
              onExploreJobs={() => setActiveTab('jobs')}
            />
          )}

          {activeTab === 'jobs' && (
            <JobBoard
              jobs={jobs}
              appliedJobIds={appliedJobIds}
              onApply={(job) => setApplyingJob(job)}
            />
          )}
        </>
      )}

      {/* Application Submission Modal */}
      {applyingJob && (
        <ApplicationModal
          job={applyingJob}
          onClose={() => setApplyingJob(null)}
          onSuccess={() => {
            loadData();
            setActiveTab('dashboard');
          }}
        />
      )}

    </div>
  );
}
