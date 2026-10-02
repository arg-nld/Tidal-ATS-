import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  Briefcase, Bell, ShieldCheck, Sparkles, LogOut
} from 'lucide-react';

export function PortalHeader({ onOpenNotifications }) {
  const { user, isHr, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const fetchUnread = async () => {
    try {
      const res = await api.notifications.getAll();
      const unread = (res.notifications || []).filter(n => !n.read).length;
      setUnreadCount(unread);
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
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">

      {/* Brand & Portal Indicator */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          {isHr ? <ShieldCheck size={20} className="text-white" /> : <Briefcase size={20} className="text-white" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-100 tracking-tight">Tidal Nexus</h1>
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
      <div className="flex items-center gap-3">

        {/* Notifications */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Automated Email Notification Log"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>

        {/* User pill */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="hidden md:block">
            <div className="text-xs font-semibold text-slate-200 line-clamp-1">{user?.name}</div>
            <div className="text-[10px] text-slate-400 capitalize">{user?.role}</div>
          </div>
        </div>

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
  );
}
