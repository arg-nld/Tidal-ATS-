import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { HrDashboardView } from './HrDashboardView';
import { HrJobsView } from './HrJobsView';
import { HrKanbanView } from './HrKanbanView';
import { HrCalendarView } from './HrCalendarView';
import { HrAnalyticsView } from './HrAnalyticsView';
import { CandidateProfileModal } from './CandidateProfileModal';
import { JobModal } from './JobModal';
import { 
  LayoutDashboard, Briefcase, Users, CalendarDays, AlertCircle,
  Trash2, ArrowRight, BarChart3 
} from 'lucide-react';
import { Spinner } from '../common/Spinner';

export function HrPortal() {
  const { user } = useAuth();
  const activeTabStorageKey = user?.id ? `ats_hr_active_tab_${user.id}` : null;
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'dashboard';
    return window.sessionStorage.getItem(user?.id ? `ats_hr_active_tab_${user.id}` : '') || 'dashboard';
  }); // 'dashboard' | 'jobs' | 'kanban' | 'calendar'
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected filters
  const [selectedJobId, setSelectedJobId] = useState('all');

  // Modals state
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [viewingCandidateId, setViewingCandidateId] = useState(null);

  const [stageMoveModal, setStageMoveModal] = useState({
    isOpen: false,
    candidate: null,
    targetStage: null,
    isMoving: false
  });

  // Deletion modal
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    type: null, // 'job' | 'candidate'
    item: null,
    isDeleting: false
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, appsRes] = await Promise.all([
        api.jobs.getAll({ status: 'all' }),
        api.applications.getAll()
      ]);
      setJobs(jobsRes.jobs || []);
      setApplications(appsRes.applications || []);
    } catch (err) {
      console.error('Failed to load HR data:', err);
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  useEffect(() => {
    if (activeTabStorageKey) {
      window.sessionStorage.setItem(activeTabStorageKey, activeTab);
    }
  }, [activeTab, activeTabStorageKey]);

  // Derived current candidate being viewed
  const viewingCandidate = viewingCandidateId
    ? applications.find(a => a.id === viewingCandidateId) || null
    : null;

  // Job Actions
  const handleSaveJob = async (jobData) => {
    try {
      if (jobData.id) {
        await api.jobs.update(jobData.id, jobData);
      } else {
        await api.jobs.create(jobData);
      }
      setIsJobModalOpen(false);
      setEditingJob(null);
      await loadData();
    } catch (err) {
      alert("Failed to save job: " + err.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.item) return;
    setDeleteModal(prev => ({ ...prev, isDeleting: true }));

    try {
      if (deleteModal.type === 'job') {
        await api.jobs.delete(deleteModal.item.id);
        if (editingJob?.id === deleteModal.item.id) {
          setIsJobModalOpen(false);
          setEditingJob(null);
        }
      } else if (deleteModal.type === 'candidate') {
        await api.applications.delete(deleteModal.item.id);
        if (viewingCandidateId === deleteModal.item.id) {
          setViewingCandidateId(null);
        }
      }
      setDeleteModal({ isOpen: false, type: null, item: null, isDeleting: false });
      await loadData();
    } catch (err) {
      alert("Failed to delete item: " + err.message);
      setDeleteModal(prev => ({ ...prev, isDeleting: false }));
    }
  };

  // Candidate Actions
  const handleUpdateCandidateInState = (updatedCandidate) => {
    setApplications(prev => prev.map(a => a.id === updatedCandidate.id ? updatedCandidate : a));
  };

  const handleUpdateStage = async (candidateId, newStage) => {
    try {
      const res = await api.applications.updateStage(candidateId, { stage: newStage });
      handleUpdateCandidateInState(res.application);
      return res.application;
    } catch (err) {
      alert("Failed to update candidate stage: " + err.message);
      return null;
    }
  };

  const requestStageChange = (candidate, targetStage) => {
    if (!candidate || !targetStage || candidate.stage === targetStage) return;
    setStageMoveModal({
      isOpen: true,
      candidate,
      targetStage,
      isMoving: false
    });
  };

  const confirmStageChange = async () => {
    if (!stageMoveModal.candidate || !stageMoveModal.targetStage) return;

    setStageMoveModal(prev => ({ ...prev, isMoving: true }));
    const updated = await handleUpdateStage(stageMoveModal.candidate.id, stageMoveModal.targetStage);

    if (updated) {
      setStageMoveModal({ isOpen: false, candidate: null, targetStage: null, isMoving: false });
    } else {
      setStageMoveModal(prev => ({ ...prev, isMoving: false }));
    }
  };

  const handleScreenCandidate = async (candidate) => {
    try {
      // Optimistic update
      setApplications(prev => prev.map(a => a.id === candidate.id ? { ...a, isScreening: true } : a));
      const res = await api.ai.screen(candidate.id);
      handleUpdateCandidateInState(res.application);
    } catch (err) {
      alert("AI Screening failed: " + err.message);
      setApplications(prev => prev.map(a => a.id === candidate.id ? { ...a, isScreening: false } : a));
    }
  };

  return (
    <div className="flex h-[calc(100vh-65px)] overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex shrink-0">
        <div className="p-4 border-b border-slate-800">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Recruiter Controls</p>
          <p className="text-xs font-semibold text-slate-200 truncate mt-0.5">{user?.name}</p>
          <p className="text-[11px] text-slate-400 truncate">{user?.title || 'Head of Talent'}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1.5">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard size={16} />
              <span>Overview</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('jobs')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'jobs'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Briefcase size={16} />
              <span>Job Openings</span>
            </div>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-full">
              {jobs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('kanban')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'kanban'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users size={16} />
              <span>Candidate Pipeline</span>
            </div>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-full">
              {applications.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'calendar'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CalendarDays size={16} />
              <span>Recruiting Calendar</span>
            </div>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded-full">
              {applications.filter(a => a.interview?.scheduledAt).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <BarChart3 size={16} />
              <span>Analytics & Reports</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full border border-indigo-500/30">
              Live
            </span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500">
          <p>Tidal ATS Backend: <span className="text-emerald-400 font-semibold">Connected</span></p>
        </div>
      </aside>

      {/* Main View Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Mobile Subheader Tabs */}
        <div className="md:hidden flex border-b border-slate-800 bg-slate-900 px-4 py-2 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'jobs' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Jobs ({jobs.length})
          </button>
          <button
            onClick={() => setActiveTab('kanban')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'kanban' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Pipeline ({applications.length})
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'calendar' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === 'analytics' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Analytics & Reports
          </button>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs flex items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
            <button onClick={loadData} className="underline hover:text-white">Retry</button>
          </div>
        )}

        {/* View Routing */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <Spinner className="w-8 h-8 text-indigo-500" />
              <p className="text-xs text-slate-400">Loading recruiter workspace...</p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <HrDashboardView
                  jobs={jobs}
                  applications={applications}
                  onNavigate={setActiveTab}
                  onViewCandidate={(c) => setViewingCandidateId(c.id)}
                  onUpdateStage={handleUpdateStage}
                  onScreenCandidate={handleScreenCandidate}
                  onAddJob={() => {
                    setEditingJob(null);
                    setIsJobModalOpen(true);
                  }}
                />
              )}

              {activeTab === 'jobs' && (
                <HrJobsView
                  jobs={jobs}
                  applications={applications}
                  onAddJob={() => {
                    setEditingJob(null);
                    setIsJobModalOpen(true);
                  }}
                  onEditJob={(j) => {
                    setEditingJob(j);
                    setIsJobModalOpen(true);
                  }}
                  onDeleteJob={(j) => {
                    setDeleteModal({
                      isOpen: true,
                      type: 'job',
                      item: j,
                      isDeleting: false
                    });
                  }}
                  onSelectJobForPipeline={(jobId) => {
                    setSelectedJobId(jobId);
                    setActiveTab('kanban');
                  }}
                />
              )}

              {activeTab === 'kanban' && (
                <HrKanbanView
                  jobs={jobs}
                  applications={applications}
                  selectedJobId={selectedJobId}
                  onSelectJobId={setSelectedJobId}
                  onViewCandidate={(c) => setViewingCandidateId(c.id)}
                  onRequestStageChange={requestStageChange}
                  onScreenCandidate={handleScreenCandidate}
                  onDeleteCandidate={(c) => {
                    setDeleteModal({
                      isOpen: true,
                      type: 'candidate',
                      item: c,
                      isDeleting: false
                    });
                  }}
                />
              )}

              {activeTab === 'calendar' && (
                <HrCalendarView
                  jobs={jobs}
                  applications={applications}
                  selectedJobId={selectedJobId}
                  onSelectJobId={setSelectedJobId}
                />
              )}

              {activeTab === 'analytics' && (
                <HrAnalyticsView
                  jobs={jobs}
                  onSelectCandidate={(candId) => setViewingCandidateId(candId)}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Candidate Profile Modal */}
      {viewingCandidate && (
        <CandidateProfileModal
          candidate={viewingCandidate}
          job={jobs.find(j => j.id === viewingCandidate.jobId)}
          applications={applications}
          onClose={() => setViewingCandidateId(null)}
          onUpdateCandidate={handleUpdateCandidateInState}
          onDelete={(c) => {
            setDeleteModal({
              isOpen: true,
              type: 'candidate',
              item: c,
              isDeleting: false
            });
          }}
        />
      )}

      {/* Job Create/Edit Modal */}
      {isJobModalOpen && (
        <JobModal
          job={editingJob}
          onClose={() => {
            setIsJobModalOpen(false);
            setEditingJob(null);
          }}
          onSave={handleSaveJob}
          onDelete={(j) => {
            setDeleteModal({
              isOpen: true,
              type: 'job',
              item: j,
              isDeleting: false
            });
          }}
        />
      )}

      {/* Pipeline Move Confirmation Modal */}
      {stageMoveModal.isOpen && (
        <div className="fixed inset-0 z-[65] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                <ArrowRight size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Confirm Pipeline Move</h3>
                <p className="text-xs text-slate-400">The candidate will be moved and the applicant will be notified.</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Move <strong className="text-white">{stageMoveModal.candidate?.name}</strong> from
                <span className="text-slate-400"> {stageMoveModal.candidate?.stage}</span>
                <span className="mx-2 text-slate-600">→</span>
                <strong className="text-indigo-300">{stageMoveModal.targetStage}</strong>?
              </p>
              <p className="text-[10px] text-slate-500 mt-2">Moving the candidate also triggers the normal applicant status notification.</p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStageMoveModal({ isOpen: false, candidate: null, targetStage: null, isMoving: false })}
                disabled={stageMoveModal.isMoving}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmStageChange}
                disabled={stageMoveModal.isMoving}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {stageMoveModal.isMoving ? 'Moving...' : 'Confirm Move'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deletion Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Confirm {deleteModal.type === 'job' ? 'Job' : 'Candidate'} Deletion
                </h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              Are you sure you want to delete <strong className="text-white">
                {deleteModal.item?.title || deleteModal.item?.name}
              </strong>?
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteModal({ isOpen: false, type: null, item: null, isDeleting: false })}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteModal.isDeleting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-all"
              >
                {deleteModal.isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
