import { useMemo, useState } from 'react';
import { Briefcase, X, Settings2 } from 'lucide-react';

const parseSkills = value => String(value || '').split(',').map(s => s.trim()).filter(Boolean);

export function JobModal({ job, onClose, onSave, onDelete }) {
  const [formData, setFormData] = useState(() => ({
    ...(job || {
      title: '', location: 'Remote', type: 'Full-time',
      experienceLevel: '', salaryRange: '', status: 'open', description: ''
    }),
    scoringWeights: job?.scoringWeights || { requiredSkills: 70, nonRequiredSkills: 20, experience: 10 },
  }));
  const [requiredSkillsText, setRequiredSkillsText] = useState((job?.requiredSkills || []).join(', '));
  const [nonRequiredSkillsText, setNonRequiredSkillsText] = useState((job?.nonRequiredSkills || []).join(', '));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalWeight = useMemo(() => Object.values(formData.scoringWeights || {}).reduce((a, b) => a + Number(b || 0), 0), [formData.scoringWeights]);

  const setWeight = (key, value) => {
    setFormData(prev => ({ ...prev, scoringWeights: { ...prev.scoringWeights, [key]: Number(value) } }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) return alert('Job title and description are required.');
    if (totalWeight !== 100) return alert('The score weights must total exactly 100%.');

    setIsSubmitting(true);
    try {
      await onSave({
        ...formData,
        requiredSkills: parseSkills(requiredSkillsText),
        nonRequiredSkills: parseSkills(nonRequiredSkillsText),
        scoringWeights: {
          requiredSkills: Number(formData.scoringWeights.requiredSkills),
          nonRequiredSkills: Number(formData.scoringWeights.nonRequiredSkills),
          experience: Number(formData.scoringWeights.experience)
        }
      });
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400"><Briefcase size={16} /></div><h2 className="text-base font-bold text-slate-100">{job ? 'Edit Job Opening' : 'Publish New Job Posting'}</h2></div><button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"><X size={18} /></button></div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-5">
          <div><label className="block text-xs font-semibold text-slate-400 mb-1">Job Title *</label><input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-slate-400 mb-1">Location</label><input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1">Employment Type</label><select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option></select></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1">Salary Range</label><input value={formData.salaryRange} onChange={e => setFormData({ ...formData, salaryRange: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1">Experience Level</label><input value={formData.experienceLevel} onChange={e => setFormData({ ...formData, experienceLevel: e.target.value })} placeholder="" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" /></div>
            <div><label className="block text-xs font-semibold text-slate-400 mb-1">Status</label><select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"><option value="open">Active / Open for Applications</option><option value="closed">Closed / Archived</option></select></div>
          </div>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-4">
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2"><Settings2 size={14} className="text-indigo-400" /> Screening Score Weights</h3><p className="text-[10px] text-slate-500 mt-1">The final candidate score is calculated from these weights, so rescoring the same resume produces the same result.</p></div><span className={`text-xs font-bold px-2 py-1 rounded-lg border ${totalWeight === 100 ? 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10' : 'text-rose-300 border-rose-500/20 bg-rose-500/10'}`}>Total {totalWeight}%</span></div>
            <div className="grid sm:grid-cols-3 gap-3">
              {[['requiredSkills','Required Skills'],['nonRequiredSkills','Non-required Skills'],['experience','Experience']].map(([key,label]) => <div key={key}><label className="block text-[10px] font-semibold text-slate-400 mb-1">{label}</label><div className="relative"><input type="number" min="0" max="100" value={formData.scoringWeights[key]} onChange={e => setWeight(key, e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 pr-8 text-xs text-slate-200" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span></div></div>)}
            </div>
            <div className="grid sm:grid-cols-2 gap-4"><div><label className="block text-[10px] font-semibold text-slate-400 mb-1">Required Skills</label><textarea rows={3} value={requiredSkillsText} onChange={e => setRequiredSkillsText(e.target.value)} placeholder="Python, SQL, Pandas, Excel" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200" /><p className="text-[10px] text-slate-600 mt-1">Comma-separated.</p></div><div><label className="block text-[10px] font-semibold text-slate-400 mb-1">Non-required Skills</label><textarea rows={3} value={nonRequiredSkillsText} onChange={e => setNonRequiredSkillsText(e.target.value)} placeholder="Power BI, Tableau, SAS" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200" /><p className="text-[10px] text-slate-600 mt-1">Helpful but not mandatory.</p></div></div>
          </div>

          <div><label className="block text-xs font-semibold text-slate-400 mb-1">Job Description & Requirements *</label><textarea rows={7} required value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200" /></div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-between"><div>{job && onDelete ? <button type="button" onClick={() => onDelete(job)} className="text-xs text-rose-400 font-semibold">Delete Job Opening</button> : null}</div><div className="flex gap-2"><button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800">Cancel</button><button type="submit" disabled={isSubmitting || totalWeight !== 100} className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white disabled:opacity-40">{isSubmitting ? 'Saving...' : job ? 'Save Changes' : 'Publish Job'}</button></div></div>
        </form>
      </div>
    </div>
  );
}
