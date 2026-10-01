import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';
import { 
  Briefcase, Users, LayoutDashboard, Plus, Search, MapPin, Building, 
  Clock, MoreVertical, X, Check, BrainCircuit, GripVertical, FileText
} from 'lucide-react';

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyASWjmstH9GsKmNhW6hDTmQc2_1fpRcj60",
  authDomain: "ats-dashboard-35950.firebaseapp.com",
  projectId: "ats-dashboard-35950",
  storageBucket: "ats-dashboard-35950.firebasestorage.app",
  messagingSenderId: "7545090710",
  appId: "1:7545090710:web:114b6ec221c4a27cccc8b7",
  measurementId: "G-SDFWFKFZS6"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ats-dashboard-mvp';

// Kanban Stages
const STAGES = ['New', 'Screened', 'Interview', 'Offer', 'Rejected'];

// Helper function to generate IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

// Loading Spinner Component
const Spinner = ({ className = "w-5 h-5" }) => (
  <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
        setError("Failed to authenticate.");
        setLoading(false);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const jobsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'jobs');
    const candidatesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'candidates');

    const unsubscribeJobs = onSnapshot(jobsRef, (snapshot) => {
      const jobsData = [];
      snapshot.forEach((doc) => jobsData.push({ id: doc.id, ...doc.data() }));
      // Sort in memory (newest first)
      jobsData.sort((a, b) => b.createdAt - a.createdAt);
      setJobs(jobsData);
      setLoading(false);
    }, (err) => {
      console.error("Jobs fetch error:", err);
      setError("Failed to load jobs.");
      setLoading(false);
    });

    const unsubscribeCandidates = onSnapshot(candidatesRef, (snapshot) => {
      const candidatesData = [];
      snapshot.forEach((doc) => candidatesData.push({ id: doc.id, ...doc.data() }));
      candidatesData.sort((a, b) => b.createdAt - a.createdAt);
      setCandidates(candidatesData);
    }, (err) => console.error("Candidates fetch error:", err));

    return () => {
      unsubscribeJobs();
      unsubscribeCandidates();
    };
  }, [user]);

  const handleSaveJob = async (jobData) => {
    if (!user) return;
    const jobId = jobData.id || generateId();
    const jobRef = doc(db, 'artifacts', appId, 'users', user.uid, 'jobs', jobId);
    
    await setDoc(jobRef, {
      ...jobData,
      createdAt: jobData.createdAt || Date.now(),
      updatedAt: Date.now()
    });
    setIsJobModalOpen(false);
    setEditingJob(null);
  };

  const handleDeleteJob = async (jobId) => {
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'jobs', jobId));
  };

  const handleSaveCandidate = async (candidateData) => {
    if (!user) return;
    const candidateId = generateId();
    const candidateRef = doc(db, 'artifacts', appId, 'users', user.uid, 'candidates', candidateId);
    
    await setDoc(candidateRef, {
      ...candidateData,
      stage: 'New',
      createdAt: Date.now(),
    });
    setIsCandidateModalOpen(false);
  };

  const updateCandidateStage = async (candidateId, newStage) => {
    if (!user) return;
    const candidateRef = doc(db, 'artifacts', appId, 'users', user.uid, 'candidates', candidateId);
    await updateDoc(candidateRef, { stage: newStage, updatedAt: Date.now() });
  };

  const runGeminiScreening = async (candidate) => {
    if (!user) return;
    const job = jobs.find(j => j.id === candidate.jobId);
    if (!job) return;

    const candidateRef = doc(db, 'artifacts', appId, 'users', user.uid, 'candidates', candidate.id);
    await updateDoc(candidateRef, { isScreening: true });

    try {
      const prompt = `Act as an expert technical recruiter. Evaluate the candidate's resume against the job description.
Job Title: ${job.title}
Job Description: ${job.description}
Candidate Resume: ${candidate.resumeText}

Return a JSON object with two fields:
- "score": A number from 0 to 100 indicating the match.
- "rationale": A brief 1-2 sentence explanation for the score.
Respond ONLY with valid JSON, no markdown formatting blocks.`;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              score: { type: "NUMBER" },
              rationale: { type: "STRING" }
            },
            required: ["score", "rationale"]
          }
        }
      };

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (textResponse) {
        const parsed = JSON.parse(textResponse);
        await updateDoc(candidateRef, {
          geminiScore: parsed.score,
          geminiRationale: parsed.rationale,
          isScreening: false,
          stage: parsed.score > 70 ? 'Screened' : 'New' // Auto-move if score is high
        });
      } else {
        throw new Error("Invalid response from Gemini");
      }
    } catch (err) {
      console.error("Gemini Error:", err);
      await updateDoc(candidateRef, { 
        isScreening: false, 
        geminiError: "Failed to generate score." 
      });
    }
  };


  if (!user || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="w-8 h-8 text-indigo-500" />
          <p className="text-slate-400 animate-pulse">Initializing ATS Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex font-sans selection:bg-indigo-500/30">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Users size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">Nexus ATS</h1>
        </div>
        <nav className="flex-1 py-6 px-4 space-y-2">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} icon={<Briefcase size={20} />} label="Job Openings" badge={jobs.length} />
          <NavItem active={activeTab === 'kanban'} onClick={() => setActiveTab('kanban')} icon={<Users size={20} />} label="Candidates" badge={candidates.length} />
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="text-xs text-slate-500 px-2 py-1">Logged in as: <span className="font-mono text-slate-400 block truncate">{user.uid}</span></div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
           <h1 className="text-xl font-bold text-slate-100">Nexus ATS</h1>
           <div className="flex gap-2">
             <button onClick={() => setActiveTab('dashboard')} className={`p-2 rounded-lg ${activeTab === 'dashboard' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400'}`}><LayoutDashboard size={20}/></button>
             <button onClick={() => setActiveTab('jobs')} className={`p-2 rounded-lg ${activeTab === 'jobs' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400'}`}><Briefcase size={20}/></button>
             <button onClick={() => setActiveTab('kanban')} className={`p-2 rounded-lg ${activeTab === 'kanban' ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400'}`}><Users size={20}/></button>
           </div>
        </header>

        {/* View Routing */}
        <div className="flex-1 overflow-auto p-6 md:p-10">
          {activeTab === 'dashboard' && <DashboardView jobs={jobs} candidates={candidates} onNavigate={setActiveTab} />}
          {activeTab === 'jobs' && <JobsView jobs={jobs} onEdit={(j) => { setEditingJob(j); setIsJobModalOpen(true); }} onDelete={handleDeleteJob} onAdd={() => { setEditingJob(null); setIsJobModalOpen(true); }} />}
          {activeTab === 'kanban' && <KanbanView jobs={jobs} candidates={candidates} onAddCandidate={() => setIsCandidateModalOpen(true)} onUpdateStage={updateCandidateStage} onScreen={runGeminiScreening} />}
        </div>
      </main>

      {/* Modals */}
      {isJobModalOpen && (
         <JobModal 
            job={editingJob} 
            onClose={() => setIsJobModalOpen(false)} 
            onSave={handleSaveJob} 
         />
      )}
      {isCandidateModalOpen && (
         <CandidateModal 
            jobs={jobs}
            onClose={() => setIsCandidateModalOpen(false)} 
            onSave={handleSaveCandidate} 
         />
      )}
    </div>
  );
}

function DashboardView({ jobs, candidates, onNavigate }) {
  const activeJobs = jobs.filter(j => j.status !== 'closed').length;
  const recentCandidates = candidates.slice(0, 5);
  
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold text-slate-100">Welcome back</h2>
        <p className="text-slate-400 mt-1">Here's what's happening with your hiring pipeline today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Active Jobs" value={activeJobs} icon={<Briefcase className="text-blue-400" />} onClick={() => onNavigate('jobs')} />
        <StatCard title="Total Candidates" value={candidates.length} icon={<Users className="text-indigo-400" />} onClick={() => onNavigate('kanban')} />
        <StatCard title="Interviews Scheduled" value={candidates.filter(c => c.stage === 'Interview').length} icon={<Clock className="text-emerald-400" />} />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg shadow-black/20">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-100">Recent Applications</h3>
          <button onClick={() => onNavigate('kanban')} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">View All</button>
        </div>
        <div className="divide-y divide-slate-800/50">
          {recentCandidates.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No candidates yet. Add some to get started.</div>
          ) : (
            recentCandidates.map(c => {
              const job = jobs.find(j => j.id === c.jobId);
              return (
                <div key={c.id} className="p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-semibold border border-slate-700">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-200">{c.name}</h4>
                      <p className="text-sm text-slate-500">{job?.title || 'Unknown Job'} • Applied {new Date(c.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <StageBadge stage={c.stage} />
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  );
}

function JobsView({ jobs, onEdit, onDelete, onAdd }) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Job Openings</h2>
          <p className="text-slate-400 mt-1">Manage your company's active roles.</p>
        </div>
        <button 
          onClick={onAdd}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-indigo-900/20"
        >
          <Plus size={18} /> New Job
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 flex-1 overflow-auto pb-8">
        {jobs.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
            <Briefcase size={48} className="mb-4 opacity-50" />
            <p className="text-lg font-medium text-slate-300">No jobs posted yet</p>
            <p className="max-w-md mt-2">Create your first job opening to start accepting candidates and managing your pipeline.</p>
          </div>
        ) : (
          jobs.map(job => (
            <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all flex flex-col group relative overflow-hidden shadow-lg shadow-black/10">
               {job.status === 'closed' && <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] z-10 pointer-events-none flex items-center justify-center"><span className="border border-red-500/50 text-red-400 bg-red-500/10 px-3 py-1 rounded-full text-sm font-semibold rotate-12 backdrop-blur-md">CLOSED</span></div>}
               <div className="flex justify-between items-start mb-4">
                 <div>
                   <h3 className="text-xl font-semibold text-slate-100 group-hover:text-indigo-400 transition-colors">{job.title}</h3>
                   <div className="flex items-center gap-2 text-sm text-slate-400 mt-2">
                     <Building size={14} /> {job.department || 'General'}
                   </div>
                 </div>
                 <div className="relative z-20 flex gap-2">
                    <button onClick={() => onEdit(job)} className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800 rounded-md transition-colors"><MoreVertical size={16}/></button>
                 </div>
               </div>
               <p className="text-slate-400 text-sm line-clamp-3 mb-6 flex-1">{job.description}</p>
               <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-800/50 pt-4 mt-auto">
                 <span>Created {new Date(job.createdAt).toLocaleDateString()}</span>
                 <span className={`px-2 py-1 rounded-md ${job.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                   {job.status === 'open' ? 'Actively Hiring' : 'Closed'}
                 </span>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function KanbanView({ jobs, candidates, onAddCandidate, onUpdateStage, onScreen }) {
  const [selectedJobId, setSelectedJobId] = useState(jobs.length > 0 ? jobs[0].id : 'all');
  
  const filteredCandidates = selectedJobId === 'all' 
    ? candidates 
    : candidates.filter(c => c.jobId === selectedJobId);

  return (
    <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-100">Candidate Pipeline</h2>
          <p className="text-slate-400 mt-1">Track and evaluate applicants across stages.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <select 
            value={selectedJobId} 
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg focus:outline-none focus:border-indigo-500 flex-1 sm:flex-none appearance-none"
          >
            <option value="all">All Jobs</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <button 
            onClick={onAddCandidate}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shrink-0 shadow-lg shadow-indigo-900/20"
          >
            <Plus size={18} /> Add Candidate
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex h-full gap-6 min-w-max px-1">
          {STAGES.map(stage => (
            <KanbanColumn 
              key={stage} 
              title={stage} 
              candidates={filteredCandidates.filter(c => c.stage === stage)}
              onUpdateStage={onUpdateStage}
              onScreen={onScreen}
              jobs={jobs}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ title, candidates, onUpdateStage, onScreen, jobs }) {
  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-slate-800/30');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('bg-slate-800/30');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-slate-800/30');
    const candidateId = e.dataTransfer.getData('candidateId');
    if (candidateId) {
      onUpdateStage(candidateId, title);
    }
  };

  return (
    <div 
      className="w-80 flex flex-col bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden h-full transition-colors"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
        <h3 className="font-semibold text-slate-200 flex items-center gap-2">
          {title}
          <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full">{candidates.length}</span>
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {candidates.map(candidate => (
          <CandidateCard 
            key={candidate.id} 
            candidate={candidate} 
            onScreen={onScreen}
            job={jobs.find(j => j.id === candidate.jobId)}
          />
        ))}
      </div>
    </div>
  );
}

function CandidateCard({ candidate, onScreen, job }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('candidateId', candidate.id);
  };

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      className="bg-slate-800 border border-slate-700 p-4 rounded-lg cursor-grab active:cursor-grabbing hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all group"
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-slate-100">{candidate.name}</h4>
        <GripVertical size={14} className="text-slate-600 group-hover:text-slate-400" />
      </div>
      
      <div className="text-xs text-slate-400 mb-3 line-clamp-1">{job?.title || 'Unknown Role'}</div>
      
      {candidate.geminiScore ? (
        <div className="bg-slate-900 rounded-md p-3 border border-slate-700/50 mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1"><BrainCircuit size={12}/> AI Score</span>
            <span className={`text-sm font-bold ${candidate.geminiScore >= 80 ? 'text-emerald-400' : candidate.geminiScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
              {candidate.geminiScore}/100
            </span>
          </div>
          <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">{candidate.geminiRationale}</p>
        </div>
      ) : (
        <button 
          onClick={() => onScreen(candidate)}
          disabled={candidate.isScreening}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
        >
          {candidate.isScreening ? <><Spinner className="w-3 h-3"/> Analyzing...</> : <><BrainCircuit size={14} /> Screen with AI</>}
        </button>
      )}
      
      {candidate.geminiError && <div className="text-xs text-red-400 mt-2">{candidate.geminiError}</div>}
    </div>
  );
}

function JobModal({ job, onClose, onSave }) {
  const [formData, setFormData] = useState(job || {
    title: '',
    department: '',
    description: '',
    status: 'open'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/50 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-100">{job ? 'Edit Job Opening' : 'Create New Job Opening'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <label className="text-sm font-medium text-slate-300">Job Title</label>
              <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500" placeholder="e.g. Senior Frontend Developer" />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <label className="text-sm font-medium text-slate-300">Department</label>
              <input value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500" placeholder="e.g. Engineering" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">Job Description</label>
            <textarea required rows={6} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 resize-none" placeholder="Enter the full job description, requirements, and responsibilities. The AI will use this to screen candidates." />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">Status</label>
            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 appearance-none">
              <option value="open">Open (Actively Hiring)</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white transition-colors">Cancel</button>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-indigo-900/20">Save Job</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CandidateModal({ jobs, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    jobId: jobs.length > 0 ? jobs[0].id : '',
    resumeText: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/50 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-100">Add Candidate</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {jobs.length === 0 && (
             <div className="bg-amber-500/10 border border-amber-500/50 text-amber-400 p-3 rounded-lg text-sm mb-4">
               You need to create a Job Opening first before adding candidates.
             </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <label className="text-sm font-medium text-slate-300">Full Name</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500" placeholder="Jane Doe" />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1">
              <label className="text-sm font-medium text-slate-300">Email</label>
              <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500" placeholder="jane@example.com" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">Applying for Role</label>
            <select required value={formData.jobId} onChange={e => setFormData({...formData, jobId: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 appearance-none">
              <option value="" disabled>Select a job...</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2"><FileText size={14}/> Resume Content</label>
            <textarea required rows={6} value={formData.resumeText} onChange={e => setFormData({...formData, resumeText: e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 resize-none font-mono text-sm" placeholder="Paste the candidate's raw resume text here. The AI will analyze this." />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white transition-colors">Cancel</button>
            <button disabled={jobs.length===0} type="submit" className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-indigo-900/20">Add Candidate</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, badge }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${active ? 'bg-indigo-600/10 text-indigo-400 font-medium' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className={`text-xs px-2 py-0.5 rounded-full ${active ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-300'}`}>{badge}</span>
      )}
    </button>
  );
}

function StatCard({ title, value, icon, onClick }) {
  return (
    <div onClick={onClick} className={`bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg shadow-black/10 ${onClick ? 'cursor-pointer hover:border-slate-700 transition-colors' : ''}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-slate-100">{value}</h3>
        </div>
        <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
          {icon}
        </div>
      </div>
    </div>
  );
}

function StageBadge({ stage }) {
  const styles = {
    'New': 'bg-slate-800 text-slate-300 border-slate-700',
    'Screened': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    'Interview': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Offer': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Rejected': 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[stage] || styles['New']}`}>
      {stage}
    </span>
  );
}

const style = document.createElement('style');
style.textContent = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #334155;
    border-radius: 20px;
  }
  .custom-scrollbar:hover::-webkit-scrollbar-thumb {
    background-color: #475569;
  }
`;
document.head.appendChild(style);