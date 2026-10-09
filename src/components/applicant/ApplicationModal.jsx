import { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Briefcase, Mail, Phone, User, Check, Send } from 'lucide-react';
import { Spinner } from '../common/Spinner';
import { ConfirmationModal } from '../common/ConfirmationModal';

export function ApplicationModal({ job, onClose, onSuccess }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', role: job?.title || '', source: 'Careers Page', skills: '', experienceSummary: '', resumeText: '', fileName: '', fileSize: 0 });
  const [isParsing, setIsParsing] = useState(false);
  const [parseSuccess, setParseSuccess] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submittedData, setSubmittedData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const fileToText = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(file); });

  const handleFile = async file => {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { setParseError('File is too large. Please upload a file smaller than 12MB.'); return; }
    setSelectedFile(file);
    setIsParsing(true); setParseError(null); setParseSuccess(false);
    try {
      let parsed;
      if (file.name.toLowerCase().endsWith('.txt')) {
        parsed = (await api.ai.parseResume({ text: await fileToText(file) })).parsed;
      } else {
        const multipart = new FormData(); multipart.append('resumeFile', file);
        parsed = (await api.ai.parseResumeFile(multipart)).parsed;
      }
      if (parsed) {
        setFormData(prev => ({ ...prev, name: parsed.name || prev.name, email: user?.email || prev.email, phone: parsed.phone || prev.phone, role: parsed.role || prev.role, skills: Array.isArray(parsed.skills) ? parsed.skills.join(', ') : prev.skills, experienceSummary: parsed.experienceSummary || prev.experienceSummary, resumeText: parsed.resumeText || prev.resumeText, fileName: file.name, fileSize: file.size }));
        setParseSuccess(true);
      }
    } catch (err) {
      setFormData(prev => ({ ...prev, fileName: file.name, fileSize: file.size }));
      setParseError(err.message || 'Could not auto-extract the resume. You can still submit the original file and enter details manually.');
    } finally { setIsParsing(false); }
  };

  const handlePreSubmit = e => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return setSubmitError('Name and email are required.');
    if (!selectedFile) return setSubmitError('Please upload a resume before submitting your application.');
    setSubmitError(null);
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const skillsArray = formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
      const multipart = new FormData();
      multipart.append('jobId', job.id);
      multipart.append('name', formData.name);
      // The backend intentionally binds applications to the signed-in applicant account.
      // A parsed resume may contain a different contact email, so never submit that as the account email.
      multipart.append('email', user?.email || formData.email);
      multipart.append('phone', formData.phone);
      multipart.append('role', formData.role || job.title);
      multipart.append('source', formData.source || 'Careers Page');
      multipart.append('skills', JSON.stringify(skillsArray));
      multipart.append('experienceSummary', formData.experienceSummary);
      multipart.append('resumeText', formData.resumeText || `Resume submitted for ${job.title} by ${formData.name}`);
      multipart.append('fileName', formData.fileName || selectedFile.name);
      multipart.append('fileSize', String(formData.fileSize || selectedFile.size));
      multipart.append('resumeFile', selectedFile);
      const res = await api.applications.submit(multipart);
      setShowConfirmModal(false);
      setSubmittedData(res.application);
      onSuccess?.(res.application);
    } catch (err) {
      setShowConfirmModal(false);
      setSubmitError(err.message || 'Failed to submit application.');
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center"><div><span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">Application Form</span><h2 className="text-lg font-bold text-slate-100 mt-1">Apply for {job.title}</h2></div><button onClick={onClose} className="text-slate-400 hover:text-white p-1.5"><X size={20} /></button></div>
        {submittedData ? (
          <div className="p-8 text-center space-y-5 my-auto"><div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto"><CheckCircle2 size={32} /></div><h3 className="text-2xl font-bold text-slate-100">Application Submitted!</h3><p className="text-sm text-slate-300">Your profile has been received for <span className="font-semibold text-white">{job.title}</span>.</p><div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 max-w-md mx-auto text-left"><div className="flex items-center gap-2 text-indigo-300 font-semibold mb-1"><Mail size={14} /> Application Received</div><p>Your original resume has been saved for HR review. Any configured confirmation email will be sent to <span className="text-slate-200 font-mono">{formData.email}</span>.</p></div><button onClick={onClose} className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs">Go to My Applications</button></div>
        ) : (
          <form onSubmit={handlePreSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-5">
            {submitError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex gap-2.5 items-start">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Application Error</span>
                  <span>{submitError}</span>
                </div>
              </div>
            )}
            <div className="space-y-2"><label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between"><span>Resume / CV Document *</span></label><div onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={e => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files?.[0]); }} onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : selectedFile ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-700 bg-slate-950/60'}`}><input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />{isParsing ? <div className="flex flex-col items-center gap-2 py-3"><Spinner className="w-6 h-6 text-indigo-400" /><p className="text-xs text-indigo-300">Reading resume...</p></div> : selectedFile ? <div className="flex items-center justify-between"><div className="flex items-center gap-3 text-left"><div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center"><FileText size={20} /></div><div><div className="text-xs font-semibold text-slate-200">{selectedFile.name}</div><div className="text-[10px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB • original file will be saved</div></div></div><span className="text-[11px] text-indigo-400">Change File</span></div> : <div className="space-y-2 py-2"><div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto"><UploadCloud size={20} /></div><p className="text-xs font-semibold text-slate-200">Drop your resume here, or <span className="text-indigo-400">browse</span></p><p className="text-[11px] text-slate-500">PDF, DOCX, or TXT up to 12MB</p></div>}</div>{parseSuccess && <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2"><Check size={14} /> Resume parsed successfully.</div>}{parseError && <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2"><AlertCircle size={14} /> {parseError}</div>}</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Full Name *</label><div className="relative"><User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200" /></div></div>
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Email Address *</label><div className="relative"><Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input required type="email" value={user?.email || formData.email} readOnly={Boolean(user?.email)} onChange={e => setFormData({ ...formData, email: e.target.value })} className={`w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 ${user?.email ? 'opacity-80 cursor-not-allowed' : ''}`} /></div></div>
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label><div className="relative"><Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200" /></div></div>
              <div><label className="block text-xs font-medium text-slate-400 mb-1">Target Role</label><div className="relative"><Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200" /></div></div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                How did you find this position? (Sourcing Channel)
              </label>
              <select
                value={formData.source}
                onChange={e => setFormData({ ...formData, source: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              >
                <option value="Careers Page">Company Careers Page</option>
                <option value="LinkedIn">LinkedIn Job Posting</option>
                <option value="JobStreet">JobStreet Philippines</option>
                <option value="Indeed">Indeed</option>
                <option value="Referral">Employee Referral</option>
                <option value="Direct / Other">Direct Application / Other</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Key Skills (comma-separated)</label><input value={formData.skills} onChange={e => setFormData({ ...formData, skills: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Background & Experience Summary</label><textarea rows={3} value={formData.experienceSummary} onChange={e => setFormData({ ...formData, experienceSummary: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Resume Text Content</label><textarea rows={4} value={formData.resumeText} onChange={e => setFormData({ ...formData, resumeText: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300" /></div>
            <div className="pt-4 border-t border-slate-800 flex justify-end gap-3"><button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800">Cancel</button><button type="submit" disabled={isSubmitting || isParsing} className="px-6 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-all">{isSubmitting ? 'Submitting Application...' : 'Submit Application'}</button></div>
          </form>
        )}
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmSubmit}
        isLoading={isSubmitting}
        title="Submit Job Application"
        message={`Are you ready to submit your formal application for ${job.title}? Your profile, contact details, and attached resume document will be forwarded directly to the hiring team.`}
        confirmText="Confirm & Submit"
        cancelText="Review Details"
        variant="primary"
        icon={Send}
        details={[
          { label: 'Applicant Name', value: formData.name },
          { label: 'Contact Email', value: user?.email || formData.email },
          { label: 'Role Applied For', value: job.title },
          { label: 'Attached Resume', value: selectedFile?.name || 'Resume document attached' },
          ...(formData.phone ? [{ label: 'Contact Number', value: formData.phone }] : [])
        ]}
      />
    </div>
  );
}
