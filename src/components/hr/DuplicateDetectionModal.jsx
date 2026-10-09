import { useState } from 'react';
import { api } from '../../services/api';
import { 
  GitMerge, CheckCircle2, AlertTriangle, X, ShieldAlert,
  ArrowRight, FileText, Calendar, Mail, Phone, User
} from 'lucide-react';
import { Spinner } from '../common/Spinner';

export function DuplicateDetectionModal({ 
  primaryCandidate, 
  duplicates = [], 
  isOpen, 
  onClose, 
  onSuccessMerge 
}) {
  if (!isOpen || !primaryCandidate) return null;

  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState(() => 
    duplicates.map(d => d.candidateId)
  );
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState(null);

  const toggleDuplicateSelection = (id) => {
    setSelectedDuplicateIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleExecuteMerge = async () => {
    if (selectedDuplicateIds.length === 0) return;
    setIsMerging(true);
    setMergeError(null);

    try {
      const res = await api.applications.mergeCandidates(primaryCandidate.id, selectedDuplicateIds);
      onSuccessMerge?.(res.application);
      onClose();
    } catch (err) {
      setMergeError(err.message || 'Failed to merge duplicate candidates.');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <GitMerge size={15} />
              </div>
              <h2 className="text-base font-bold text-slate-100">Duplicate Candidate Detection & Merge</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Review potential matching profiles and consolidate into a single primary record
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
          {mergeError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{mergeError}</span>
            </div>
          )}

          {/* Primary Record Card */}
          <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30 space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Primary Retained Profile
            </span>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <h3 className="font-bold text-slate-100 text-sm">{primaryCandidate.name}</h3>
                <p className="text-slate-400 mt-0.5">{primaryCandidate.email} • {primaryCandidate.phone || 'No phone'}</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Applied for: <span className="text-slate-300 font-semibold">{primaryCandidate.role}</span> ({primaryCandidate.stage})</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-mono text-slate-500 block">Record ID: {primaryCandidate.id}</span>
                <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  Target Record
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <ArrowRight size={14} className="text-indigo-400" />
            <span>Select duplicate records to merge into the primary profile:</span>
          </div>

          {/* Matching Duplicate Profiles */}
          <div className="space-y-3">
            {duplicates.map(dup => {
              const isSelected = selectedDuplicateIds.includes(dup.candidateId);
              return (
                <div 
                  key={dup.candidateId}
                  onClick={() => toggleDuplicateSelection(dup.candidateId)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-indigo-600/5 border-indigo-500/40 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent div click
                        className="mt-1 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-200">{dup.candidateName}</h4>
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                            {dup.stage}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {dup.candidateEmail} {dup.candidatePhone ? `• ${dup.candidatePhone}` : ''}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Job: <span className="text-slate-300">{dup.role}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="inline-block text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                        {dup.confidence}% Match
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {dup.reasons?.map((r, i) => (
                          <span key={i} className="text-[10px] text-slate-400 block">
                            • {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Merge Behavior Explanation */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <span className="font-bold text-slate-300 block">Data Preservation Guarantee:</span>
            <ul className="list-disc list-inside space-y-0.5 text-slate-400">
              <li>All recruiter notes from duplicate profiles will be appended to the primary record.</li>
              <li>Interview logs, scorecards, and audit timeline entries are consolidated chronologically.</li>
              <li>Original records are linked with a cross-reference tag so no candidate history is lost.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {selectedDuplicateIds.length} duplicate record(s) selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteMerge}
              disabled={isMerging || selectedDuplicateIds.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20"
            >
              {isMerging ? (
                <>
                  <Spinner className="w-3.5 h-3.5" />
                  <span>Merging Records...</span>
                </>
              ) : (
                <>
                  <GitMerge size={14} />
                  <span>Confirm & Merge Records</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
