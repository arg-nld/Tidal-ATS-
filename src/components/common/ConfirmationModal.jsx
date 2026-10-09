import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, HelpCircle, Trash2, X, AlertTriangle } from 'lucide-react';
import { Spinner } from './Spinner';

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  details = null,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary', // 'primary' | 'danger' | 'warning' | 'success'
  icon: CustomIcon = null,
  isLoading = false
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      border: 'border-rose-500/30',
      badgeBg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      btn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30',
      defaultIcon: Trash2
    },
    warning: {
      border: 'border-amber-500/30',
      badgeBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      btn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30',
      defaultIcon: AlertTriangle
    },
    success: {
      border: 'border-emerald-500/30',
      badgeBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      btn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30',
      defaultIcon: CheckCircle2
    },
    primary: {
      border: 'border-indigo-500/30',
      badgeBg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
      btn: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/30',
      defaultIcon: HelpCircle
    }
  }[variant] || {
    border: 'border-slate-800',
    badgeBg: 'bg-slate-800 text-slate-300 border-slate-700',
    btn: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    defaultIcon: HelpCircle
  };

  const IconComponent = CustomIcon || variantStyles.defaultIcon;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className={`bg-slate-900 border ${variantStyles.border} rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col`}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${variantStyles.badgeBg}`}>
              <IconComponent size={20} />
            </div>
            <div>
              <h3 id="confirm-modal-title" className="text-base font-bold text-slate-100">
                {title}
              </h3>
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                Action Confirmation
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-40"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            {message}
          </p>

          {details && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-2 text-xs">
              {Array.isArray(details) ? (
                <ul className="space-y-1.5 text-slate-300">
                  {details.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : typeof details === 'object' ? (
                Object.entries(details).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center py-0.5 border-b border-slate-900 last:border-none">
                    <span className="text-slate-500 capitalize">{key}:</span>
                    <span className="font-semibold text-slate-200">{String(val)}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-300">{details}</div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50 ${variantStyles.btn}`}
          >
            {isLoading ? (
              <>
                <Spinner className="w-3.5 h-3.5" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
