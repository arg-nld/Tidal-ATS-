export function StageBadge({ stage, size = "md" }) {
  const sizeClasses = size === "sm" 
    ? "text-[10px] px-2 py-0.5" 
    : "text-xs px-2.5 py-1 font-medium";

  const getStyle = (s) => {
    switch (s) {
      case 'Application Submitted':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'Initial Screening':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'Shortlisted':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'Interview Scheduled':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'Job Offer':
        return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
      case 'Hired':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
      case 'Rejected':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${getStyle(stage)} ${sizeClasses}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {stage || 'Unknown'}
    </span>
  );
}

export function StatusBadge({ status }) {
  const isOpen = status === 'open';
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
      isOpen ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      {isOpen ? 'Active Opening' : 'Closed'}
    </span>
  );
}
