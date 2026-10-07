import { useEffect, useRef, useState } from 'react';
import {
  BrainCircuit, Calendar, Trash2, GripVertical, MessageSquare, ChevronRight
} from 'lucide-react';
import { PIPELINE_STAGES } from '../../constants/pipeline';
import { Spinner } from '../common/Spinner';

const AUTO_PAN_EDGE = 90;
const AUTO_PAN_SPEED = 14;

export function HrKanbanView({
  jobs,
  applications,
  selectedJobId,
  onSelectJobId,
  onViewCandidate,
  onRequestStageChange,
  onScreenCandidate,
  onDeleteCandidate
}) {
  const filteredApps = selectedJobId === 'all'
    ? applications
    : applications.filter(a => a.jobId === selectedJobId);

  const boardRef = useRef(null);
  const autoPanTimerRef = useRef(null);
  const autoPanDirectionRef = useRef(0);
  const draggedCandidateRef = useRef(null);

  const stopAutoPan = () => {
    if (autoPanTimerRef.current) {
      window.clearInterval(autoPanTimerRef.current);
      autoPanTimerRef.current = null;
    }
  };

  const updateAutoPan = (clientX) => {
    const board = boardRef.current;
    if (!board) return;

    const rect = board.getBoundingClientRect();
    let direction = 0;

    if (clientX < rect.left + AUTO_PAN_EDGE) direction = -1;
    if (clientX > rect.right - AUTO_PAN_EDGE) direction = 1;

    if (!direction) {
      stopAutoPan();
      return;
    }

    // Keep the latest drag direction so the pan can reverse immediately while
    // the same drag operation remains active.
    autoPanDirectionRef.current = direction;

    if (!autoPanTimerRef.current) {
      autoPanTimerRef.current = window.setInterval(() => {
        if (boardRef.current && autoPanDirectionRef.current) {
          boardRef.current.scrollLeft += autoPanDirectionRef.current * AUTO_PAN_SPEED;
        }
      }, 16);
    }
  };

  useEffect(() => () => stopAutoPan(), []);

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Top Controls & Job Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Candidate Pipeline Board</h2>
          <p className="text-xs text-slate-400 mt-1">
            Drag candidates across lifecycle stages. The move is confirmed before the status and applicant notification are updated.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-medium">Filter by Job:</label>
          <select
            value={selectedJobId}
            onChange={(e) => onSelectJobId(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[280px]"
          >
            <option value="all">All Jobs ({applications.length} candidates)</option>
            {jobs.map(j => {
              const count = applications.filter(a => a.jobId === j.id).length;
              return <option key={j.id} value={j.id}>{j.title} ({count})</option>;
            })}
          </select>
        </div>
      </div>

      {/* Horizontal Scrollable Kanban Columns */}
      <div
        ref={boardRef}
        className="flex-1 overflow-x-auto pb-4 custom-scrollbar overscroll-x-contain"
        onDragOver={(e) => {
          e.preventDefault();
          updateAutoPan(e.clientX);
        }}
        onDrop={stopAutoPan}
        onDragEnd={stopAutoPan}
      >
        <div className="flex gap-4 min-w-max h-[calc(100vh-250px)] px-1">
          {PIPELINE_STAGES.map((stage, stageIdx) => {
            const stageCandidates = filteredApps.filter(a => a.stage === stage);
            const nextStage = PIPELINE_STAGES[stageIdx + 1] || null;

            return (
              <KanbanColumn
                key={stage}
                stage={stage}
                stageIdx={stageIdx}
                nextStage={nextStage}
                candidates={stageCandidates}
                jobs={jobs}
                onRequestStageChange={onRequestStageChange}
                draggedCandidateRef={draggedCandidateRef}
                onViewCandidate={onViewCandidate}
                onScreenCandidate={onScreenCandidate}
                onDeleteCandidate={onDeleteCandidate}
              />
            );
          })}
        </div>
      </div>

    </div>
  );
}

function KanbanColumn({
  stage,
  stageIdx,
  nextStage,
  candidates,
  jobs,
  onRequestStageChange,
  draggedCandidateRef,
  onViewCandidate,
  onScreenCandidate,
  onDeleteCandidate
}) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = (e) => {
    e.stopPropagation();
    setIsOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);
    const candidateId = e.dataTransfer.getData('candidateId');
    const candidate = candidates.find(c => c.id === candidateId)
      || draggedCandidateRef.current;

    if (candidate && candidate.stage !== stage) {
      onRequestStageChange(candidate, stage);
    }
    draggedCandidateRef.current = null;
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-72 sm:w-80 flex flex-col rounded-2xl border transition-all ${
        isOver
          ? 'bg-indigo-950/20 border-indigo-500 shadow-xl shadow-indigo-950/30'
          : 'bg-slate-900/60 border-slate-800/90'
      }`}
    >
      {/* Column Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-slate-500">
            0{stageIdx + 1}
          </span>
          <h3 className="font-bold text-xs text-slate-200">{stage}</h3>
        </div>
        <span className="text-xs font-mono font-semibold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
          {candidates.length}
        </span>
      </div>

      {/* Cards Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
        {candidates.length === 0 ? (
          <div className="h-28 flex flex-col items-center justify-center text-[11px] text-slate-600 border border-dashed border-slate-800/80 rounded-xl">
            <span>No candidates in {stage}</span>
            <span className="text-[10px] text-slate-700">Drag profile here to advance</span>
          </div>
        ) : (
          candidates.map(candidate => (
            <KanbanCard
              key={candidate.id}
              candidate={candidate}
              nextStage={nextStage}
              job={jobs.find(j => j.id === candidate.jobId)}
              onViewCandidate={onViewCandidate}
              onRequestStageChange={onRequestStageChange}
              draggedCandidateRef={draggedCandidateRef}
              onScreenCandidate={onScreenCandidate}
              onDeleteCandidate={onDeleteCandidate}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  candidate,
  nextStage,
  job,
  onViewCandidate,
  onRequestStageChange,
  draggedCandidateRef,
  onScreenCandidate,
  onDeleteCandidate
}) {
  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('candidateId', candidate.id);
    // Keep the full candidate object available for a drop across columns.
    draggedCandidateRef.current = candidate;
  };

  const handleDragEnd = () => {
    draggedCandidateRef.current = null;
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onViewCandidate(candidate)}
      className="bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 p-4 rounded-xl cursor-grab active:cursor-grabbing transition-all hover:shadow-lg hover:shadow-indigo-950/20 group space-y-2.5"
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
            {candidate.name}
          </h4>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">
            {job?.title || candidate.role}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onDeleteCandidate(candidate)}
            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-all"
            title="Delete Candidate"
          >
            <Trash2 size={13} />
          </button>
          <GripVertical size={13} className="text-slate-600 group-hover:text-slate-400" />
        </div>
      </div>

      {/* Skills Pills */}
      {candidate.skills && candidate.skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {candidate.skills.slice(0, 3).map((skill, idx) => (
            <span
              key={idx}
              className="bg-slate-900 text-slate-300 border border-slate-800 text-[10px] px-1.5 py-0.2 rounded"
            >
              {skill}
            </span>
          ))}
          {candidate.skills.length > 3 && (
            <span className="text-[10px] text-slate-500 font-mono">
              +{candidate.skills.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Scheduled Interview Tag if exists */}
      {candidate.interview && (
        <div className="bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg flex items-center justify-between text-[10px] text-amber-300">
          <span className="flex items-center gap-1 font-medium">
            <Calendar size={11} /> Interview Scheduled
          </span>
          <span className="font-mono text-slate-400">
            {new Date(candidate.interview.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        </div>
      )}

      {/* Recruiter Notes Indicator */}
      {candidate.recruiterNotes && (
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <MessageSquare size={11} className="text-indigo-400" />
          <span className="line-clamp-1 italic">"{candidate.recruiterNotes}"</span>
        </div>
      )}

      {/* AI Score Badge or Trigger */}
      <div onClick={(e) => e.stopPropagation()}>
        {candidate.geminiScore !== null && candidate.geminiScore !== undefined ? (
          <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
              <BrainCircuit size={11} className="text-indigo-400" /> AI Score
            </span>
            <span className={`text-[11px] font-extrabold px-1.5 py-0.2 rounded ${
              candidate.geminiScore >= 80 ? 'text-emerald-400 bg-emerald-500/10' :
              candidate.geminiScore >= 60 ? 'text-amber-400 bg-amber-500/10' :
              'text-rose-400 bg-rose-500/10'
            }`}>
              {candidate.geminiScore}/100
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onScreenCandidate(candidate)}
            disabled={candidate.isScreening}
            className="w-full py-1.5 text-[10px] font-semibold bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {candidate.isScreening ? (
              <>
                <Spinner className="w-3 h-3" />
                <span>Screening...</span>
              </>
            ) : (
              <>
                <BrainCircuit size={12} />
                <span>Screen with Gemini AI</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Quick Advance Button */}
      {nextStage && (
        <div className="pt-1.5 border-t border-slate-900 flex justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onRequestStageChange(candidate, nextStage)}
            className="text-[10px] font-semibold text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            title={`Advance to ${nextStage} and send automatic email`}
          >
            <span>Move to {nextStage}</span>
            <ChevronRight size={11} />
          </button>
        </div>
      )}

    </div>
  );
}
