import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { X, Trash2, FileText, BrainCircuit, RefreshCw, Calendar, Video, Check, CheckCircle2, Sparkles, MessageSquare, ExternalLink, ChevronRight, Paperclip, Send, Download, AlertCircle } from 'lucide-react';
import { StageBadge } from '../common/Badge';
import { Spinner } from '../common/Spinner';
import { PIPELINE_STAGES } from '../../constants/pipeline';
export { PIPELINE_STAGES };

const pad = n => String(n).padStart(2, '0');
const dateKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const formatTime = value => {
  if (!value) return '';
  const [hour, minute] = value.split(':').map(Number);
  const d = new Date(); d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};
const buildSlots = () => Array.from({ length: 288 }, (_, i) => { const total = i * 5; return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`; });
const timeSlots = buildSlots();
const defaultInterviewBody = (candidate, job, date, time) => `Hi ${candidate?.name || 'there'},\n\nWe would like to invite you to an interview for the ${job?.title || 'position'}.\n\nDate: ${date ? new Date(`${date}T00:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD'}\nTime: ${formatTime(time) || 'TBD'}\nInterviewer(s): [add interviewer name above]\nMeeting link: [add meeting link above]\n\nPlease reply to this email if you need to discuss the schedule.\n\nBest regards,\nTidal Talent Team`;

export function CandidateProfileModal({ candidate, job, applications = [], onClose, onUpdateCandidate, onDelete }) {
  if (!candidate) return null;

  const [activeTab, setActiveTab] = useState('overview');
  const [targetStage, setTargetStage] = useState(candidate.stage);
  const [stageNote, setStageNote] = useState('');
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [notes, setNotes] = useState(candidate.recruiterNotes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [isScreening, setIsScreening] = useState(false);
  const [screeningError, setScreeningError] = useState(null);

  const existingInterview = candidate.interview;
  const initialDate = existingInterview?.scheduledAt ? new Date(existingInterview.scheduledAt) : new Date();
  const [interviewDate, setInterviewDate] = useState(dateKey(initialDate));
  const initialMinute = Math.floor(initialDate.getMinutes() / 5) * 5;
  const [timeIndex, setTimeIndex] = useState(Math.max(0, timeSlots.indexOf(`${pad(initialDate.getHours())}:${pad(initialMinute)}`)));
  const [interviewer, setInterviewer] = useState(existingInterview?.interviewer || 'Sarah Lin (Talent Lead)');
  const [meetingLink, setMeetingLink] = useState(existingInterview?.meetingLink || '');
  const [emailSubject, setEmailSubject] = useState(existingInterview?.emailSubject || `Interview Invitation — ${job?.title || candidate.role || 'Position'}`);
  const [emailBody, setEmailBody] = useState(existingInterview?.emailBody || defaultInterviewBody(candidate, job, dateKey(initialDate), timeSlots[Math.max(0, timeSlots.indexOf(`${pad(initialDate.getHours())}:${pad(initialDate.getMinutes() >= 30 ? 30 : 0)}`))] || '09:00'));
  const [attachments, setAttachments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [interviewSuccess, setInterviewSuccess] = useState(false);
  const [showScheduleConfirmation, setShowScheduleConfirmation] = useState(false);
  const [timeWheelMotion, setTimeWheelMotion] = useState(null);
  const [resumeUrl, setResumeUrl] = useState(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState(null);

  const selectedTime = timeSlots[timeIndex] || '09:00';
  const [selectedHour, selectedMinute] = selectedTime.split(':').map(Number);
  const displayHour = selectedHour > 12 ? selectedHour - 12 : selectedHour === 0 ? 12 : selectedHour;
  const displayPeriod = selectedHour >= 12 ? 'PM' : 'AM';
  const slotDateTime = `${interviewDate}T${selectedTime}`;

  const bookedSlotSet = useMemo(() => {
    const set = new Set();
    bookings.forEach(item => {
      const d = new Date(item.scheduledAt);
      if (Number.isNaN(d.getTime())) return;
      set.add(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    });
    return set;
  }, [bookings]);

  useEffect(() => {
    let cancelled = false;
    setLoadingAvailability(true);
    api.applications.getAvailability(interviewDate, candidate.id)
      .then(res => { if (!cancelled) setBookings(res.bookings || []); })
      .catch(err => { if (!cancelled) setBookings([]); console.warn('Availability load failed:', err); })
      .finally(() => { if (!cancelled) setLoadingAvailability(false); });
    return () => { cancelled = true; };
  }, [interviewDate, candidate.id]);

  useEffect(() => {
    if (!bookings.length) return;
    if (!bookedSlotSet.has(selectedTime)) return;

    const firstAvailable = timeSlots.findIndex(time => !bookedSlotSet.has(time));
    if (firstAvailable >= 0 && firstAvailable !== timeIndex) {
      setTimeIndex(firstAvailable);
    }
  }, [bookings, bookedSlotSet, selectedTime, timeIndex]);

  useEffect(() => {
    if (activeTab !== 'resume' || resumeUrl || resumeLoading) return;
    handleViewResume();
  }, [activeTab, candidate.id]);

  useEffect(() => {
    setTargetStage(candidate.stage);
    setNotes(candidate.recruiterNotes || '');
    if (candidate.interview?.scheduledAt) {
      const d = new Date(candidate.interview.scheduledAt);
      const nextIndex = timeSlots.indexOf(`${pad(d.getHours())}:${pad(Math.floor(d.getMinutes() / 5) * 5)}`);
      setInterviewDate(dateKey(d));
      setTimeIndex(nextIndex >= 0 ? nextIndex : 2);
      setInterviewer(candidate.interview.interviewer || interviewer);
      setMeetingLink(candidate.interview.meetingLink || '');
      setEmailSubject(candidate.interview.emailSubject || `Interview Invitation — ${job?.title || candidate.role || 'Position'}`);
      setEmailBody(candidate.interview.emailBody || defaultInterviewBody(candidate, job, dateKey(d), nextIndex >= 0 ? timeSlots[nextIndex] : '09:00'));
    }
  }, [candidate.id]);

  const handleUpdateStage = async () => {
    if (targetStage === candidate.stage) return;
    setIsUpdatingStage(true);
    try {
      const res = await api.applications.updateStage(candidate.id, { stage: targetStage, customNote: stageNote });
      onUpdateCandidate(res.application);
    } catch (err) { alert(`Failed to update stage: ${err.message}`); } finally { setIsUpdatingStage(false); }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      const res = await api.applications.updateNotes(candidate.id, notes);
      onUpdateCandidate(res.application); setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2500);
    } catch (err) { alert(`Failed to save notes: ${err.message}`); } finally { setIsSavingNotes(false); }
  };

  const handleScreenCandidate = async () => {
    setIsScreening(true); setScreeningError(null);
    try { const res = await api.ai.screen(candidate.id); onUpdateCandidate(res.application); }
    catch (err) { setScreeningError(err.message || 'Screening failed'); }
    finally { setIsScreening(false); }
  };

  const validateInterviewSchedule = () => {
    if (!interviewDate || !selectedTime || !interviewer.trim()) {
      alert('Please provide interview date, time, and interviewer.');
      return false;
    }
    if (!emailSubject.trim() || !emailBody.trim()) {
      alert('Please provide the email subject and body.');
      return false;
    }
    if (bookedSlotSet.has(selectedTime)) {
      alert('That time is already booked. Choose another time.');
      return false;
    }
    return true;
  };

  // First click only opens the safety review. No interview is created and no
  // email is sent until the HR user confirms the final details.
  const handleScheduleInterview = e => {
    e.preventDefault();
    if (!validateInterviewSchedule()) return;
    setShowScheduleConfirmation(true);
  };

  const handleConfirmScheduleInterview = async () => {
    if (!validateInterviewSchedule()) {
      setShowScheduleConfirmation(false);
      return;
    }

    setIsScheduling(true);
    setInterviewSuccess(false);
    try {
      const data = new FormData();
      data.append('scheduledAt', slotDateTime);
      data.append('interviewer', interviewer);
      data.append('meetingLink', meetingLink);
      data.append('notes', '');
      data.append('emailSubject', emailSubject);
      data.append('emailBody', emailBody);
      attachments.forEach(file => data.append('emailAttachments', file));
      const res = await api.applications.scheduleInterview(candidate.id, data);
      onUpdateCandidate(res.application);
      setInterviewSuccess(true);
      setTargetStage('Interview Scheduled');
      setAttachments([]);
      setShowScheduleConfirmation(false);
      setTimeout(() => setInterviewSuccess(false), 4000);
    } catch (err) {
      alert(`Failed to schedule interview: ${err.message}`);
    } finally {
      setIsScheduling(false);
    }
  };

  const triggerTimeWheelMotion = (column, direction) => {
    setTimeWheelMotion({ column, direction, key: Date.now() });
    window.setTimeout(() => setTimeWheelMotion(null), 190);
  };

  const setTimeIndexAndBody = (nextIndex, column = null, direction = 0) => {
    if (nextIndex < 0 || nextIndex >= timeSlots.length || bookedSlotSet.has(timeSlots[nextIndex])) return;
    setTimeIndex(nextIndex);
    setEmailBody(prev => prev.replace(/Time: .*\n/, `Time: ${formatTime(timeSlots[nextIndex])}\n`));
    if (column && direction) triggerTimeWheelMotion(column, direction);
  };

  const changeTimeByMinutes = direction => {
    const nextMinutes = selectedHour * 60 + selectedMinute + direction;
    const nextIndex = timeSlots.findIndex(slot => {
      const [h, m] = slot.split(':').map(Number);
      return h * 60 + m === nextMinutes;
    });
    if (nextIndex >= 0) setTimeIndexAndBody(nextIndex, 'Minute', direction);
  };

  const changeHour = direction => {
    const nextHour = (selectedHour + direction + 24) % 24;
    const nextIndex = timeSlots.findIndex(slot => {
      const [h, m] = slot.split(':').map(Number);
      return h === nextHour && m === selectedMinute;
    });
    if (nextIndex >= 0) setTimeIndexAndBody(nextIndex, 'Hour', direction);
  };

  // Minute arrows are independent from the hour. Moving past :55 wraps to :00
  // without changing the hour; the hour arrow is the only control that changes hours.
  const changeMinute = direction => {
    const nextMinute = (selectedMinute + direction * 5 + 60) % 60;
    const nextIndex = timeSlots.findIndex(slot => {
      const [h, m] = slot.split(':').map(Number);
      return h === selectedHour && m === nextMinute;
    });
    if (nextIndex >= 0) setTimeIndexAndBody(nextIndex, 'Minute', direction);
  };
  const changePeriod = direction => {
    const targetHour = (selectedHour + direction * 12 + 24) % 24;
    const nextIndex = timeSlots.findIndex(slot => {
      const [h, m] = slot.split(':').map(Number);
      return h === targetHour && m === selectedMinute;
    });
    if (nextIndex >= 0) setTimeIndexAndBody(nextIndex, 'AM/PM', direction);
  };

  const handleViewResume = async () => {
    setActiveTab('resume');
    if (!candidate.resumeFile) {
      setResumeError('This legacy/demo application does not have the original uploaded file attached. New applications will retain it for HR preview.');
      return;
    }
    setResumeLoading(true); setResumeError(null);
    try {
      const { blob } = await api.applications.getResumeBlob(candidate.id);
      setResumeUrl(URL.createObjectURL(blob));
      setActiveTab('resume');
    } catch (err) { setResumeError(err.message); }
    finally { setResumeLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0"><div className="flex items-center gap-3"><div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-lg flex items-center justify-center">{candidate.name?.charAt(0).toUpperCase() || 'C'}</div><div><div className="flex items-center gap-2"><h2 className="text-lg font-bold text-slate-100">{candidate.name}</h2><StageBadge stage={candidate.stage} size="sm" /></div><p className="text-xs text-slate-400">Applied for <span className="text-slate-200 font-semibold">{job?.title || candidate.role}</span></p></div></div><div className="flex items-center gap-2"><button onClick={() => onDelete(candidate)} className="text-xs text-rose-400 px-3 py-1.5 rounded-xl border border-rose-500/20 hover:bg-rose-500/10 font-semibold flex items-center gap-1.5"><Trash2 size={13}/> Delete</button><button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"><X size={20}/></button></div></div>

        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 shrink-0">{[{id:'overview',label:'Overview & Status'},{id:'interview',label:'Interview Scheduling',badge:candidate.interview?'Scheduled':null},{id:'resume',label:'Original Resume'}].map(tab => <button key={tab.id} onClick={() => { if (tab.id === 'resume') handleViewResume(); else setActiveTab(tab.id); }} className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 ${activeTab===tab.id?'border-indigo-500 text-indigo-300':'border-transparent text-slate-400 hover:text-slate-200'}`}><span>{tab.label}</span>{tab.badge&&<span className="text-[10px] bg-indigo-500/15 text-indigo-400 px-1.5 rounded-full border border-indigo-500/30">{tab.badge}</span>}</button>)}</div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {activeTab === 'overview' && <div className="space-y-6">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Sparkles size={16} className="text-indigo-400"/><h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Hiring Pipeline</h3></div><span className="text-[11px] text-slate-500">Stage changes can email the applicant</span></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><div className="sm:col-span-2"><label className="block text-[11px] font-medium text-slate-400 mb-1">Target Pipeline Stage</label><select value={targetStage} onChange={e=>setTargetStage(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200">{PIPELINE_STAGES.map(s=><option key={s}>{s}</option>)}</select></div><button onClick={handleUpdateStage} disabled={isUpdatingStage||targetStage===candidate.stage} className="h-9 self-end bg-indigo-600 disabled:opacity-40 text-white rounded-xl text-xs font-semibold">{isUpdatingStage?'Updating...':'Apply Stage Change'}</button></div><div><label className="block text-[11px] text-slate-500 mb-1">Optional note to applicant</label><input value={stageNote} onChange={e=>setStageNote(e.target.value)} placeholder="Optional status note" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"/></div></div>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5"><div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4"><h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Candidate Information</h3><div className="grid sm:grid-cols-2 gap-4 text-xs"><div><span className="text-slate-500 block">Email</span><span className="font-semibold text-slate-200">{candidate.email}</span></div><div><span className="text-slate-500 block">Phone</span><span className="font-semibold text-slate-200">{candidate.phone || '—'}</span></div><div><span className="text-slate-500 block">Applied On</span><span className="font-semibold text-slate-200">{candidate.createdAt ? new Date(candidate.createdAt).toLocaleDateString() : '—'}</span></div><div><span className="text-slate-500 block">Resume</span><button onClick={handleViewResume} className="text-indigo-400 font-semibold inline-flex items-center gap-1">{resumeLoading?'Loading...':'View original'} <ExternalLink size={11}/></button></div></div>{candidate.skills?.length>0&&<div><span className="text-slate-500 text-[11px] block mb-1.5">Identified Skills</span><div className="flex flex-wrap gap-1.5">{candidate.skills.map((skill,idx)=><span key={idx} className="bg-slate-900 text-slate-300 border border-slate-800 text-[11px] px-2.5 py-0.5 rounded-lg">{skill}</span>)}</div></div>}{candidate.experienceSummary&&<div className="pt-2 border-t border-slate-800"><span className="text-slate-500 text-[11px] block mb-1">Experience Summary</span><p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-xl">{candidate.experienceSummary}</p></div>}</div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4"><div className="flex items-center justify-between"><span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><BrainCircuit size={13} className="text-indigo-400"/> ATS Match Score</span><span className="text-[10px] text-slate-500">Deterministic</span></div>{candidate.geminiScore != null ? <><div className={`text-4xl font-extrabold text-center ${candidate.geminiScore>=80?'text-emerald-400':candidate.geminiScore>=60?'text-amber-400':'text-rose-400'}`}>{candidate.geminiScore}<span className="text-sm font-normal text-slate-500">/100</span></div>{candidate.screeningBreakdown&&<div className="space-y-1.5 text-[11px]">{[['Required skills','requiredSkills'],['Non-required skills','nonRequiredSkills'],['Experience','experience']].map(([label,key])=><div key={key} className="flex justify-between"><span className="text-slate-500">{label} ({candidate.screeningWeights?.[key] ?? job?.scoringWeights?.[key] ?? 0}%)</span><span className="text-slate-200 font-semibold">{candidate.screeningBreakdown[key]}%</span></div>)}</div>}<p className="text-[11px] text-slate-300 bg-indigo-500/5 border border-indigo-500/20 p-3 rounded-xl leading-relaxed">{candidate.geminiRationale}</p></> : <p className="text-xs text-slate-500 text-center py-5">No screening score yet.</p>} {screeningError&&<p className="text-[11px] text-rose-400">{screeningError}</p>}<button onClick={handleScreenCandidate} disabled={isScreening} className="w-full py-2 rounded-xl text-xs font-semibold bg-indigo-600/15 border border-indigo-500/30 text-indigo-300 flex items-center justify-center gap-2">{isScreening?<><Spinner className="w-3.5 h-3.5"/>Recalculating...</>:<><RefreshCw size={12}/>{candidate.geminiScore!=null?'Recalculate Score':'Run ATS Screening'}</>}</button></div></div>

            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3"><div className="flex items-center justify-between"><h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2"><MessageSquare size={15} className="text-indigo-400"/> Internal Recruiter Notes</h3>{notesSaved&&<span className="text-xs text-emerald-400"><Check size={13}/> Saved</span>}</div><textarea rows={4} value={notes} onChange={e=>setNotes(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200"/><div className="flex justify-end"><button onClick={handleSaveNotes} disabled={isSavingNotes} className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">{isSavingNotes?'Saving...':'Save Recruiter Notes'}</button></div></div>
          </div>}

          {activeTab === 'interview' && <form onSubmit={handleScheduleInterview} className="space-y-5"><div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4"><div><h3 className="text-sm font-bold text-slate-100 flex items-center gap-2"><Calendar size={16} className="text-indigo-400"/>{candidate.interview?'Reschedule Interview':'Schedule Candidate Interview'}</h3><p className="text-xs text-slate-400 mt-1">Booked times are disabled. The selected time is also checked again on the server.</p></div><div className="grid md:grid-cols-2 gap-4"><div><label className="block text-xs font-medium text-slate-400 mb-1">Date *</label><input type="date" required value={interviewDate} onChange={e=>{setInterviewDate(e.target.value);setEmailBody(defaultInterviewBody(candidate,job,e.target.value,selectedTime));}} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"/></div><div><label className="block text-xs font-medium text-slate-400 mb-1">Time *</label><div className="flex items-center justify-center gap-1 bg-slate-900 border border-slate-800 rounded-xl p-2">
              {[{ label: 'Hour', value: pad(displayHour), up: () => changeHour(1), down: () => changeHour(-1) }, { label: 'Minute', value: pad(selectedMinute), up: () => changeMinute(1), down: () => changeMinute(-1) }, { label: 'AM/PM', value: displayPeriod, up: () => changePeriod(1), down: () => changePeriod(-1) }].map(column => (
                <div key={column.label} className="flex flex-col items-center time-wheel-column">
                  <button type="button" onClick={column.up} aria-label={`Increase ${column.label}`} className="time-wheel-arrow w-12 h-7 rounded-t-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-indigo-600/20 hover:text-white flex items-center justify-center text-lg font-bold">↑</button>
                  <div
                    key={`${column.label}-${column.value}-${timeWheelMotion?.column === column.label ? timeWheelMotion.key : ''}`}
                    className={`time-wheel-value w-12 h-10 flex items-center justify-center bg-slate-950 border-x border-slate-700 text-base font-bold text-slate-100 font-mono ${
                      timeWheelMotion?.column === column.label
                        ? timeWheelMotion.direction > 0 ? 'time-wheel-value--up' : 'time-wheel-value--down'
                        : ''
                    }`}
                  >{column.value}</div>
                  <button type="button" onClick={column.down} aria-label={`Decrease ${column.label}`} className="time-wheel-arrow w-12 h-7 rounded-b-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-indigo-600/20 hover:text-white flex items-center justify-center text-lg font-bold">↓</button>
                  <span className="text-[8px] uppercase tracking-wider text-slate-600 mt-1">{column.label}</span>
                </div>
              ))}
            </div><p className="text-[10px] text-slate-600 mt-1">Hour and minute are independent. Minutes move in 5-minute steps. The clock supports the full 24-hour day.</p></div></div><div>{loadingAvailability?<p className="text-[10px] text-slate-500">Checking availability...</p>:bookings.length>0?<div className="flex flex-wrap gap-1.5"><span className="text-[10px] text-slate-500 mr-1">Booked:</span>{bookings.map(item=><span key={item.applicationId+item.scheduledAt} className="text-[10px] text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg">{new Date(item.scheduledAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</span>)}</div>:<p className="text-[10px] text-emerald-400">No interviews booked for this date.</p>}</div><div className="grid md:grid-cols-2 gap-4"><div><label className="block text-xs font-medium text-slate-400 mb-1">Interviewer(s) *</label><input required value={interviewer} onChange={e=>setInterviewer(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"/></div><div><label className="block text-xs font-medium text-slate-400 mb-1">Video Meeting URL</label><input type="url" value={meetingLink} onChange={e=>setMeetingLink(e.target.value)} placeholder="https://meet.google.com/xyz" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"/></div></div></div>

            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4"><div><h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2"><MailIcon/> Email Composer</h3><p className="text-[10px] text-slate-500 mt-1">The email below is sent to the applicant's actual email address through your configured provider.</p></div><div><label className="block text-xs font-medium text-slate-400 mb-1">To</label><input value={candidate.email} readOnly className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400"/></div><div><label className="block text-xs font-medium text-slate-400 mb-1">Subject *</label><input required value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"/></div><div><label className="block text-xs font-medium text-slate-400 mb-1">Body *</label><textarea required rows={9} value={emailBody} onChange={e=>setEmailBody(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-sans leading-relaxed"/></div><div><label className="block text-xs font-medium text-slate-400 mb-1">Attachments</label><label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 cursor-pointer hover:border-slate-600"><Paperclip size={14}/> Add attachments<input type="file" multiple className="hidden" onChange={e=>setAttachments(Array.from(e.target.files || []))}/></label>{attachments.length>0&&<div className="mt-2 space-y-1">{attachments.map(file=><div key={`${file.name}-${file.size}`} className="text-[11px] text-slate-400 flex items-center gap-2"><FileText size={12}/>{file.name} <span className="text-slate-600">({Math.round(file.size/1024)} KB)</span></div>)}</div>}</div></div>

            <div className="flex items-center justify-between">{interviewSuccess?<span className="text-xs text-emerald-400 flex items-center gap-1.5"><CheckCircle2 size={15}/> Interview scheduled and email sent.</span>:<span/>}<button type="submit" disabled={isScheduling||bookedSlotSet.has(selectedTime)} className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white disabled:opacity-40 flex items-center gap-2">{isScheduling?<Spinner className="w-3.5 h-3.5"/>:<Send size={14}/>} {isScheduling?'Preparing...':'Review & Schedule'}</button></div></form>}

          {activeTab === 'resume'  && <div className="space-y-4"><div className="flex items-center justify-between"><div><h3 className="text-sm font-bold text-slate-100 flex items-center gap-2"><FileText size={16} className="text-indigo-400"/> Original Resume</h3><p className="text-[11px] text-slate-500">{candidate.resumeFile?.originalName || candidate.fileName || 'No file attached'}</p></div>{candidate.resumeFile?.originalName&&<button onClick={async()=>{try{const {blob}=await api.applications.getResumeBlob(candidate.id);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=candidate.resumeFile.originalName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(err){setResumeError(err.message);}}} className="px-3 py-2 rounded-xl bg-slate-800 text-xs text-slate-200 flex items-center gap-2"><Download size={13}/> Download</button>}</div>{resumeError&&<div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex gap-2"><AlertCircle size={14}/>{resumeError}</div>}{resumeUrl&&candidate.resumeFile?.mimeType==='application/pdf'?<iframe title={`${candidate.name} original resume`} src={resumeUrl} className="w-full h-[650px] rounded-xl border border-slate-800 bg-white"/>:<div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 text-center space-y-3"><FileText size={30} className="mx-auto text-slate-600"/><p className="text-sm text-slate-300">{candidate.resumeFile ? 'The original file is stored. PDFs can be previewed here; DOCX/TXT files can be downloaded.' : 'This older demo application has extracted resume text but no original upload. New applications will retain the original file.'}</p>{candidate.resumeText&&<details className="text-left"><summary className="cursor-pointer text-xs text-indigo-300">Show extracted text for cross-reference</summary><div className="mt-3 p-4 bg-slate-900 rounded-xl text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[450px] overflow-y-auto">{candidate.resumeText}</div></details>}</div>}</div>}


        {showScheduleConfirmation && (
          <div className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="schedule-confirmation-title"
              className="w-full max-w-2xl max-h-[88vh] overflow-hidden bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col"
            >
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-amber-300">
                    <AlertCircle size={17}/>
                    <h3 id="schedule-confirmation-title" className="text-sm font-bold text-slate-100">Confirm Interview Schedule</h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Review the final email and interview time before anything is sent.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScheduleConfirmation(false)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
                  aria-label="Close confirmation"
                  disabled={isScheduling}
                >
                  <X size={18}/>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Candidate</p>
                    <p className="text-xs font-semibold text-slate-100">{candidate.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{candidate.email}</p>
                  </div>
                  <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
                    <p className="text-[10px] uppercase tracking-wider text-indigo-300 mb-1">Interview Time</p>
                    <p className="text-sm font-bold text-white">
                      {new Date(`${interviewDate}T00:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-indigo-200 mt-1">{formatTime(selectedTime)}</p>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    <div><span className="text-slate-500">Interviewer(s)</span><p className="text-slate-200 font-semibold mt-0.5">{interviewer}</p></div>
                    <div><span className="text-slate-500">Meeting Link</span><p className="text-slate-200 font-semibold mt-0.5 break-all">{meetingLink || 'None provided'}</p></div>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Email Preview</p>
                  <div className="text-[11px] text-slate-500 mb-1">To: <span className="text-slate-300">{candidate.email}</span></div>
                  <div className="text-xs font-semibold text-indigo-300 mb-3">{emailSubject}</div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{emailBody}</div>
                  {attachments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800">
                      <p className="text-[10px] text-slate-500 mb-1.5">Attachments</p>
                      <div className="flex flex-wrap gap-1.5">
                        {attachments.map(file => <span key={`${file.name}-${file.size}`} className="text-[10px] text-slate-300 bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg">{file.name}</span>)}
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
                  This action will save the interview schedule and send the email to the candidate.
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 flex justify-end gap-2 bg-slate-900/90">
                <button
                  type="button"
                  onClick={() => setShowScheduleConfirmation(false)}
                  disabled={isScheduling}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
                >
                  Go Back & Edit
                </button>
                <button
                  type="button"
                  onClick={handleConfirmScheduleInterview}
                  disabled={isScheduling}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2"
                >
                  {isScheduling ? <Spinner className="w-3.5 h-3.5"/> : <Send size={14}/>} {isScheduling ? 'Sending...' : 'Confirm & Send'}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function MailIcon() { return <span className="inline-flex"><Send size={13} className="text-indigo-400"/></span>; }
