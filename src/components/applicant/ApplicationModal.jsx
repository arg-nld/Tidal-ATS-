import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { 
  X, UploadCloud, FileText, Sparkles, CheckCircle2, 
  AlertCircle, Briefcase, Mail, Phone, User, Check 
} from 'lucide-react';
import { Spinner } from '../common/Spinner';

export function ApplicationModal({ job, onClose, onSuccess }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: job?.title || '',
    skills: '',
    experienceSummary: '',
    resumeText: '',
    fileName: '',
    fileSize: 0
  });

  const [isParsing, setIsParsing] = useState(false);
  const [parseSuccess, setParseSuccess] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submittedData, setSubmittedData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // File to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result;
        const b64 = typeof res === 'string' && res.includes(',') ? res.split(',')[1] : res;
        resolve(b64);
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const fileToText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const handleFile = async (file) => {
    if (!file) return;

    if (file.size > 12 * 1024 * 1024) {
      setParseError("File is too large. Please upload a file smaller than 12MB.");
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setParseSuccess(false);

    try {
      let parsed = null;
      const fileNameLower = file.name.toLowerCase();

      if (fileNameLower.endsWith('.txt')) {
        const textContent = await fileToText(file);
        const res = await api.ai.parseResume({ text: textContent });
        parsed = res.parsed;
      } else {
        const base64 = await fileToBase64(file);
        const mimeType = file.type || 'application/pdf';
        const res = await api.ai.parseResume({ base64, mimeType });
        parsed = res.parsed;
      }

      if (parsed) {
        setFormData(prev => ({
          ...prev,
          name: parsed.name || prev.name,
          email: parsed.email || prev.email,
          phone: parsed.phone || prev.phone,
          role: parsed.role || prev.role,
          skills: Array.isArray(parsed.skills) ? parsed.skills.join(', ') : prev.skills,
          experienceSummary: parsed.experienceSummary || prev.experienceSummary,
          resumeText: parsed.resumeText || prev.resumeText,
          fileName: file.name,
          fileSize: file.size
        }));
        setParseSuccess(true);
      }
    } catch (err) {
      console.warn("AI resume parsing note:", err);
      // Fallback: still store file name and allow manual entry
      setFormData(prev => ({
        ...prev,
        fileName: file.name,
        fileSize: file.size
      }));
      setParseError("Could not auto-extract with AI, but file is attached. You can type or paste resume details manually.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setSubmitError("Name and email are required.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const skillsArray = formData.skills
        ? formData.skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const payload = {
        jobId: job.id,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role || job.title,
        skills: skillsArray,
        experienceSummary: formData.experienceSummary,
        resumeText: formData.resumeText || `Resume submitted for ${job.title} by ${formData.name}`,
        fileName: formData.fileName,
        fileSize: formData.fileSize
      };

      const res = await api.applications.submit(payload);
      setSubmittedData(res.application);
      if (onSuccess) onSuccess(res.application);
    } catch (err) {
      console.error("Submission failed:", err);
      setSubmitError(err.message || "Failed to submit application.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/90 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                Application Form
              </span>
              <span className="text-xs text-slate-400">• {job.department}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 mt-1">
              Apply for {job.title}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Success View */}
        {submittedData ? (
          <div className="p-8 text-center space-y-5 my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-100">Application Submitted!</h3>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                Your profile has been received for <span className="font-semibold text-white">{job.title}</span>.
              </p>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 max-w-md mx-auto space-y-2 mt-4 text-left">
                <div className="flex items-center gap-2 text-indigo-300 font-semibold">
                  <Mail size={14} /> Automated Notification Sent
                </div>
                <p>
                  A confirmation email has been dispatched to <span className="text-slate-200 font-mono">{formData.email}</span>. You can track your real-time status under the "My Applications" tab.
                </p>
              </div>
            </div>
            <div className="pt-4 flex justify-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/30"
              >
                Go to My Applications
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar space-y-5">
            
            {submitError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{submitError}</span>
              </div>
            )}

            {/* Resume Upload Drag & Drop Zone */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Resume / CV Document</span>
                <span className="text-[11px] text-indigo-400 font-normal flex items-center gap-1">
                  <Sparkles size={11} /> Auto-fill with Gemini AI
                </span>
              </label>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.length > 0) handleFile(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  isDragging 
                    ? 'border-indigo-500 bg-indigo-500/10' 
                    : formData.fileName 
                      ? 'border-emerald-500/40 bg-emerald-500/5' 
                      : 'border-slate-700 hover:border-slate-600 bg-slate-950/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files?.length > 0) handleFile(e.target.files[0]);
                  }}
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                />

                {isParsing ? (
                  <div className="flex flex-col items-center gap-2 py-3">
                    <Spinner className="w-6 h-6 text-indigo-400" />
                    <p className="text-xs text-indigo-300 font-medium">Extracting candidate data with Gemini AI...</p>
                  </div>
                ) : formData.fileName ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-left">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                        <FileText size={20} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{formData.fileName}</div>
                        <div className="text-[10px] text-slate-500">{(formData.fileSize / 1024).toFixed(1)} KB</div>
                      </div>
                    </div>
                    <span className="text-[11px] text-indigo-400 hover:underline">Change File</span>
                  </div>
                ) : (
                  <div className="space-y-2 py-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                      <UploadCloud size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">
                        Drop your resume here, or <span className="text-indigo-400">browse</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Supports PDF, DOCX, or TXT up to 12MB</p>
                    </div>
                  </div>
                )}
              </div>

              {parseSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <Check size={14} /> Resume parsed successfully! Contact info and skills have been populated.
                </div>
              )}

              {parseError && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                  <AlertCircle size={14} /> {parseError}
                </div>
              )}
            </div>

            {/* Candidate Information Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Full Name *</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Jordan Hayes"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email Address *</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jordan@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Target Role</label>
                <div className="relative">
                  <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder={job.title}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Key Skills (comma-separated)
              </label>
              <input
                type="text"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                placeholder="e.g. React, Node.js, TypeScript, Docker, PostgreSQL"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Background & Experience Summary
              </label>
              <textarea
                rows={3}
                value={formData.experienceSummary}
                onChange={(e) => setFormData({ ...formData, experienceSummary: e.target.value })}
                placeholder="Briefly describe your career background and what makes you a great fit..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Resume Text Content
              </label>
              <textarea
                rows={4}
                value={formData.resumeText}
                onChange={(e) => setFormData({ ...formData, resumeText: e.target.value })}
                placeholder="Paste or preview full resume text here..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isParsing}
                className="px-6 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="w-3.5 h-3.5" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <span>Submit Application</span>
                )}
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
}
