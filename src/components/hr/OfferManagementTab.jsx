import { useState } from 'react';
import { api } from '../../services/api';
import { 
  FileCheck, Send, CheckCircle2, XCircle, AlertCircle, 
  Calendar, DollarSign, Clock, ShieldCheck, RefreshCw, FileText
} from 'lucide-react';
import { Spinner } from '../common/Spinner';

const STATUS_BADGES = {
  draft: { label: 'Draft', color: 'bg-slate-800 text-slate-300 border-slate-700' },
  approved: { label: 'Approved (Ready to Send)', color: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
  sent: { label: 'Offer Sent (Awaiting Candidate)', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  accepted: { label: 'Offer Accepted! (Hired)', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  declined: { label: 'Offer Declined', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  expired: { label: 'Offer Expired', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  withdrawn: { label: 'Offer Withdrawn', color: 'bg-slate-800 text-slate-400 border-slate-700' }
};

export function OfferManagementTab({ candidate: propCandidate, application, job, onUpdateCandidate: propOnUpdate, onUpdateApplication }) {
  const candidate = propCandidate || application || {};
  const onUpdateCandidate = propOnUpdate || onUpdateApplication || (() => {});
  const offer = candidate.offer || null;
  const isExpired = offer?.expiryDate && new Date(offer.expiryDate).getTime() < Date.now() && offer.status === 'sent';
  const effectiveStatus = isExpired ? 'expired' : (offer?.status || 'none');

  const [isEditing, setIsEditing] = useState(!offer);
  const [compensation, setCompensation] = useState(offer?.compensation || '');
  const [currency, setCurrency] = useState(offer?.currency || '₱');
  const [salaryPeriod, setSalaryPeriod] = useState(offer?.salaryPeriod || 'monthly');
  const [proposedStartDate, setProposedStartDate] = useState(offer?.proposedStartDate || '');
  const [expiryDate, setExpiryDate] = useState(offer?.expiryDate || '');
  const [notes, setNotes] = useState(offer?.notes || '');
  const [terms, setTerms] = useState(offer?.terms || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [error, setError] = useState(null);

  // Dialog for decline/withdraw reason
  const [promptModal, setPromptModal] = useState({
    isOpen: false,
    action: null, // 'decline' | 'withdraw'
    reason: ''
  });

  const handleSaveOfferDraft = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        compensation: Number(compensation),
        currency,
        salaryPeriod,
        proposedStartDate,
        expiryDate: expiryDate || null,
        notes,
        terms
      };

      const res = await api.applications.createOrUpdateOffer(candidate.id, payload);
      onUpdateCandidate(res.application);
      setIsEditing(false);
      setActionMessage('Offer draft saved successfully.');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save offer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveOffer = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.applications.approveOffer(candidate.id, 'Approved by HR Lead');
      onUpdateCandidate(res.application);
      setActionMessage('Offer approved! Ready for candidate delivery.');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendOffer = async () => {
    if (!window.confirm(`Are you sure you want to extend this formal offer to ${candidate.name} (${candidate.email})? An official offer email will be sent and the stage will move to "Job Offer".`)) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.applications.sendOffer(candidate.id);
      onUpdateCandidate(res.application);
      setActionMessage('Job offer dispatched and candidate notified via email!');
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPromptAction = async () => {
    const { action, reason } = promptModal;
    setIsSubmitting(true);
    setError(null);

    try {
      if (action === 'withdraw') {
        const res = await api.applications.withdrawOffer(candidate.id, reason);
        onUpdateCandidate(res.application);
        setActionMessage('Offer withdrawn.');
      } else if (action === 'decline') {
        const res = await api.applications.respondToOffer(candidate.id, { action: 'decline', declineReason: reason });
        onUpdateCandidate(res.application);
        setActionMessage('Offer recorded as declined.');
      }
      setPromptModal({ isOpen: false, action: null, reason: '' });
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptOffer = async () => {
    if (!window.confirm(`Confirm acceptance of this offer for ${candidate.name}? This will mark the candidate as "Hired" and complete the hiring pipeline.`)) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.applications.respondToOffer(candidate.id, { action: 'accept' });
      onUpdateCandidate(res.application);
      setActionMessage('Offer marked as accepted! Candidate status updated to Hired.');
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Action / Error Banner */}
      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 size={15} />
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Offer Overview Header */}
      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2.5">
              <FileCheck size={18} className="text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-100">Official Job Offer</h3>
              {effectiveStatus !== 'none' && (
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${STATUS_BADGES[effectiveStatus]?.color || 'bg-slate-800 text-slate-300'}`}>
                  {STATUS_BADGES[effectiveStatus]?.label || effectiveStatus}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Manage compensation, start dates, and formal offer dispatch</p>
          </div>

          {offer && !isEditing && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Edit Offer Terms
              </button>
            </div>
          )}
        </div>

        {/* Existing Offer Summary Cards */}
        {offer && !isEditing ? (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Compensation</span>
                <span className="text-base font-black text-indigo-400 font-mono">
                  {offer.currency} {Number(offer.compensation).toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 block capitalize">per {offer.salaryPeriod}</span>
              </div>

              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Proposed Start Date</span>
                <span className="text-sm font-bold text-slate-200 block">
                  {offer.proposedStartDate ? new Date(offer.proposedStartDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">Target onboarding</span>
              </div>

              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Offer Expiration</span>
                <span className={`text-sm font-bold block ${isExpired ? 'text-rose-400' : 'text-slate-200'}`}>
                  {offer.expiryDate ? new Date(offer.expiryDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Expiry'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">
                  {isExpired ? 'Expired' : 'Candidate response deadline'}
                </span>
              </div>
            </div>

            {offer.terms && (
              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Benefits & Terms</span>
                <p className="text-slate-300 whitespace-pre-line leading-relaxed">{offer.terms}</p>
              </div>
            )}

            {offer.notes && (
              <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/80 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Internal HR Notes</span>
                <p className="text-slate-400 text-[11px]">{offer.notes}</p>
              </div>
            )}

            {/* Action Buttons for Offer Lifecycle */}
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {offer.status === 'draft' && (
                  <button
                    onClick={handleApproveOffer}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white flex items-center gap-1.5 transition-all"
                  >
                    <ShieldCheck size={14} /> Approve Offer
                  </button>
                )}

                {(offer.status === 'approved' || offer.status === 'draft') && (
                  <button
                    onClick={handleSendOffer}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
                  >
                    <Send size={14} /> Send Formal Offer
                  </button>
                )}

                {offer.status === 'sent' && (
                  <>
                    <button
                      onClick={handleAcceptOffer}
                      disabled={isSubmitting}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-all"
                    >
                      <CheckCircle2 size={14} /> Mark as Accepted
                    </button>
                    <button
                      onClick={() => setPromptModal({ isOpen: true, action: 'decline', reason: '' })}
                      disabled={isSubmitting}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 flex items-center gap-1.5"
                    >
                      <XCircle size={14} /> Candidate Declined
                    </button>
                  </>
                )}
              </div>

              {['draft', 'approved', 'sent'].includes(offer.status) && (
                <button
                  onClick={() => setPromptModal({ isOpen: true, action: 'withdraw', reason: '' })}
                  disabled={isSubmitting}
                  className="text-xs text-slate-500 hover:text-rose-400 font-semibold"
                >
                  Withdraw Offer
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Offer Edit / Creation Form */
          <form onSubmit={handleSaveOfferDraft} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="₱">PHP (₱)</option>
                  <option value="$">USD ($)</option>
                  <option value="€">EUR (€)</option>
                  <option value="£">GBP (£)</option>
                  <option value="S$">SGD (S$)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Base Compensation *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="1000"
                  value={compensation}
                  onChange={e => setCompensation(e.target.value)}
                  placeholder="e.g. 150000"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Pay Period</label>
                <select
                  value={salaryPeriod}
                  onChange={e => setSalaryPeriod(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                  <option value="bi-weekly">Bi-weekly</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Target Start Date *</label>
                <input
                  type="date"
                  required
                  value={proposedStartDate}
                  onChange={e => setProposedStartDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Offer Expiration Date (Optional)</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={e => setExpiryDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Terms, Benefits & Equity Description</label>
              <textarea
                rows={3}
                value={terms}
                onChange={e => setTerms(e.target.value)}
                placeholder="Details on 13th month pay, health insurance coverage, remote work allowance, performance bonus, and stock options..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Internal HR Notes</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Internal notes regarding budget approval or negotiation range..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2.5">
              {offer && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-2"
              >
                {isSubmitting ? <Spinner className="w-3.5 h-3.5" /> : <FileCheck size={14} />}
                <span>Save Offer Terms</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Offer Revision History */}
      {offer?.history?.length > 0 && (
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Clock size={14} className="text-indigo-400" />
            Offer History & Audit Trail
          </h4>
          <div className="space-y-2">
            {offer.history.map((h, idx) => (
              <div key={idx} className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-200 capitalize">{h.action}</span>
                  <span className="text-slate-400 ml-2">by {h.performedBy}</span>
                  {h.notes && <p className="text-[11px] text-slate-400 mt-0.5">{h.notes}</p>}
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {new Date(h.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decline / Withdraw Prompt Modal */}
      {promptModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100 capitalize">
              {promptModal.action === 'withdraw' ? 'Withdraw Job Offer' : 'Candidate Declined Offer'}
            </h3>
            <p className="text-xs text-slate-400">
              Please enter the reason or comments for this action. It will be recorded in the candidate activity timeline.
            </p>
            <textarea
              rows={3}
              required
              value={promptModal.reason}
              onChange={e => setPromptModal(prev => ({ ...prev, reason: e.target.value }))}
              placeholder={promptModal.action === 'withdraw' ? 'Reason for offer withdrawal (e.g. headcount freeze)...' : 'Candidate feedback (e.g. counter-offer, compensation, commute)...'}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPromptModal({ isOpen: false, action: null, reason: '' })}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPromptAction}
                disabled={isSubmitting || !promptModal.reason.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
              >
                {isSubmitting ? 'Recording...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
