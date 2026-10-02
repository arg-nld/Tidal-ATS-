import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Mail, Check, X, Bell, Clock, ChevronRight, Sparkles } from 'lucide-react';
import { StageBadge } from './Badge';

export function NotificationDrawer({ isOpen, onClose, onRefreshCount }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const res = await api.notifications.getAll();
      setNotifications(res.notifications || []);
      if (onRefreshCount) {
        const unread = (res.notifications || []).filter(n => !n.read).length;
        onRefreshCount(unread);
      }
    } catch (err) {
      console.warn('Could not fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifs();
    }
  }, [isOpen]);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.notifications.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      if (onRefreshCount) {
        onRefreshCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Mail size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Automated Email Dispatch Log</h3>
              <p className="text-[11px] text-slate-400">Pipeline trigger notifications</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* List of Notifications */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-xs">Loading email log...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs flex flex-col items-center gap-2">
              <Bell size={24} className="text-slate-600" />
              <span>No notifications recorded yet.</span>
              <span className="text-[11px] text-slate-600">Status changes in the pipeline will trigger automatic emails.</span>
            </div>
          ) : (
            notifications.map(notif => (
              <div 
                key={notif.id}
                onClick={(e) => {
                  e.preventDefault();
                  if (!notif.read) handleMarkAsRead(notif.id);
                  setSelectedNotif(notif);
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  notif.read 
                    ? 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700' 
                    : 'bg-indigo-950/20 border-indigo-500/30 hover:border-indigo-500/60 shadow-md shadow-indigo-950/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StageBadge stage={notif.stage} size="sm" />
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(notif.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <h4 className="text-xs font-semibold text-slate-200 line-clamp-1 mb-1">
                  {notif.subject}
                </h4>
                
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {notif.body}
                </p>

                <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                  <span>To: <span className="text-slate-400">{notif.recipientEmail}</span></span>
                  <span className="text-indigo-400 flex items-center gap-0.5 hover:text-indigo-300">
                    View email <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {/* Selected Email Detailed Preview Modal */}
      {selectedNotif && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-indigo-400" />
                <h3 className="font-semibold text-slate-100 text-sm">Dispatched Email Message</h3>
              </div>
              <button 
                onClick={() => setSelectedNotif(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Recipient:</span>
                  <span className="font-medium text-slate-200">{selectedNotif.recipientName} &lt;{selectedNotif.recipientEmail}&gt;</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Subject:</span>
                  <span className="font-semibold text-indigo-300">{selectedNotif.subject}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sent At:</span>
                  <span className="font-mono text-slate-400">{new Date(selectedNotif.sentAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-500">Trigger Stage:</span>
                  <StageBadge stage={selectedNotif.stage} size="sm" />
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Message Body</h4>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-sans text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto custom-scrollbar">
                  {selectedNotif.body}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
              <button 
                onClick={() => setSelectedNotif(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
