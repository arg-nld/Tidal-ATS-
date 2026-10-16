import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  Bell, LogOut, Trash2, X, ShieldAlert
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';

export function PortalHeader({ onOpenNotifications, notificationCount = 0, onNotificationCountChange }) {
  const { user, isHr, logout } = useAuth();
  const { theme } = useTheme();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const closeDeleteModal = () => {
    if (deletingAccount) return;
    setShowDeleteAccount(false);
    setDeletePassword('');
    setDeleteConfirmation('');
    setDeleteError('');
  };

  useEffect(() => {
    if (!showDeleteAccount) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeDeleteModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDeleteAccount, deletingAccount]);

  const handleDeleteAccount = async () => {
    setDeleteError('');
    setDeletingAccount(true);
    try {
      await api.auth.deleteAccount(deletePassword, deleteConfirmation.trim());
      localStorage.removeItem('ats_token');
      localStorage.removeItem('ats_role');
      localStorage.removeItem('ats_user');
      window.location.assign('/');
    } catch (error) {
      setDeleteError(error.message || 'We could not delete your account. Please try again.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const fetchUnread = async () => {
    try {
      const res = await api.notifications.getAll();
      const unread = (res.notifications || []).filter(n => !n.read).length;
      onNotificationCountChange?.(unread);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <>
      <header className="portal-header bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 sm:px-5 lg:px-6 py-3 flex items-center justify-between gap-3 sticky top-0 z-30">

        {/* Brand & Portal Indicator */}
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={theme === 'dark' ? '/tidal-logo-dark.png' : '/tidal-logo.png'}
            alt="TIDAL solutions"
            className="tidal-header-logo shrink-0"
          />
          <div className="portal-brand-divider hidden sm:block" />
          <div className="portal-brand-meta min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-slate-100 tracking-tight">Talent</h1>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isHr
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}>
                {isHr ? 'HR & Recruiter Portal' : 'Applicant Portal'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isHr ? 'Hiring Pipeline & Candidate Lifecycle' : 'Job Opportunities & Application Status'}
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">

          <ThemeToggle compact />

          {/* Notifications */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Automated Email Notification Log"
          >
            <Bell size={16} />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                {notificationCount}
              </span>
            )}
          </button>

          {/* User pill */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="hidden md:block">
              <div className="text-xs font-semibold text-slate-200 line-clamp-1">{user?.name}</div>
              <div className="text-[10px] text-slate-400 capitalize">{user?.role}</div>
            </div>
          </div>

          {/* Delete account */}
          <button
            type="button"
            onClick={() => { setDeleteError(''); setDeletePassword(''); setDeleteConfirmation(''); setShowDeleteAccount(true); }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/10 border border-slate-700 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-all"
            title="Delete account"
            aria-label="Delete account"
          >
            <Trash2 size={16} />
          </button>

          {/* Sign Out */}
          {!confirmLogout ? (
            <button
              onClick={() => setConfirmLogout(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/10 border border-slate-700 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-all"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-rose-500/30 rounded-xl px-2.5 py-1.5 shadow-lg">
              <span className="text-[11px] text-rose-300 font-medium">Sign out?</span>
              <button
                onClick={logout}
                className="text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-500 px-2 py-0.5 rounded-lg transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmLogout(false)}
                className="text-[11px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

        </div>
      </header>

      {showDeleteAccount && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeleteModal();
          }}
        >
          <div
            className="flex min-h-full items-center justify-center"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeDeleteModal();
            }}
          >
            <div
              className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-rose-500/30 bg-slate-950 p-5 shadow-2xl animate-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-rose-500/10 p-2 text-rose-400 shrink-0">
                    <ShieldAlert size={21} />
                  </div>
                  <div>
                    <h2 id="delete-account-title" className="text-base font-bold text-white">Delete your account?</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-400">This action cannot be undone.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={deletingAccount}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
                  aria-label="Close delete account dialog"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs leading-5 text-slate-300">
                {isHr
                  ? 'Your HR login and its sessions will be removed. Shared jobs, applicant records, and resumes will be preserved. You cannot delete the last HR account.'
                  : 'Your account, applications, and original resume files linked to those applications will be permanently deleted.'}
              </div>

              <label className="mt-4 block text-xs font-semibold text-slate-300" htmlFor="delete-account-password">
                Current password
              </label>
              <input
                id="delete-account-password"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={event => setDeletePassword(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-500 transition-colors"
                placeholder="Enter your password"
                disabled={deletingAccount}
              />

              <label className="mt-4 block text-xs font-semibold text-slate-300" htmlFor="delete-account-confirmation">
                Type DELETE to confirm
              </label>
              <input
                id="delete-account-confirmation"
                type="text"
                autoComplete="off"
                value={deleteConfirmation}
                onChange={event => setDeleteConfirmation(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-500 transition-colors"
                placeholder="DELETE"
                disabled={deletingAccount}
              />

              {deleteError && (
                <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {deleteError}
                </p>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={closeDeleteModal}
                  className="rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingAccount || !deletePassword || deleteConfirmation.trim() !== 'DELETE'}
                  onClick={handleDeleteAccount}
                  className="rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40 transition-colors shadow-lg shadow-rose-900/30"
                >
                  {deletingAccount ? 'Deleting…' : 'Permanently delete'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
