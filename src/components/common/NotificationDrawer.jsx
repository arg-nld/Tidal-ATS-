import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Mail, X, Bell, Clock, ChevronRight, ArrowLeft } from 'lucide-react';
import { StageBadge } from './Badge';

export function NotificationDrawer({ isOpen, onClose, onRefreshCount }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const res = await api.notifications.getAll();
      const list = res.notifications || [];
      setNotifications(list);
      onRefreshCount?.(list.filter(n => !n.read).length);
    } catch (err) { console.warn('Could not fetch notifications:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!isOpen) {
      setSelectedNotif(null);
      return;
    }
    fetchNotifs();
  }, [isOpen]);

  const handleOpen = (notif) => {
    // Switch the drawer to the message view immediately. Reading a message
    // must never be responsible for opening/closing the drawer.
    setSelectedNotif({ ...notif, read: true });
    setNotifications(prev => {
      const next = prev.map(n => n.id === notif.id ? { ...n, read: true } : n);
      onRefreshCount?.(next.filter(n => !n.read).length);
      return next;
    });

    // Persist the read state independently. A network/server failure should
    // not affect the currently open message view.
    if (!notif.read) {
      void api.notifications.markAsRead(notif.id).catch(err => {
        console.warn('Could not mark notification as read:', err);
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
      onMouseDown={event => {
        if (event.target !== event.currentTarget) event.stopPropagation();
      }}
    >
      <div
        onPointerDownCapture={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}
        onKeyDown={event => event.stopPropagation()}
        className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl"
      >
        {selectedNotif ? (
          <>
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <button type="button" onClick={() => setSelectedNotif(null)} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800">
                  <ArrowLeft size={16}/>
                </button>
                <div>
                  <h3 className="font-semibold text-slate-100 text-sm">Email Message</h3>
                  <p className="text-[11px] text-slate-400">Notification details</p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800">
                <X size={18}/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div><span className="text-slate-500">Recipient:</span> <span className="text-slate-200">{selectedNotif.recipientName} &lt;{selectedNotif.recipientEmail}&gt;</span></div>
                <div><span className="text-slate-500">Subject:</span> <span className="text-indigo-300 font-semibold">{selectedNotif.subject}</span></div>
                <div><span className="text-slate-500">Sent:</span> <span className="text-slate-400">{new Date(selectedNotif.sentAt).toLocaleString()}</span></div>
                <div className="pt-1"><StageBadge stage={selectedNotif.stage} size="sm"/></div>
              </div>
              <div>
                <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Message Body</h4>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{selectedNotif.body}</div>
              </div>
            </div>
            <div className="px-6 py-3 border-t border-slate-800 flex justify-end">
              <button type="button" onClick={() => setSelectedNotif(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold">Back to notifications</button>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400"><Mail size={16}/></div>
                <div><h3 className="font-semibold text-slate-100 text-sm">Notifications</h3><p className="text-[11px] text-slate-400">Email and status messages</p></div>
              </div>
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"><X size={18}/></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
              {loading ? <div className="text-center py-12 text-slate-500 text-xs">Loading notifications...</div> : notifications.length === 0 ? <div className="text-center py-16 text-slate-500 text-xs flex flex-col items-center gap-2"><Bell size={24} className="text-slate-600"/><span>No notifications yet.</span></div> : notifications.map(notif => (
                <div
                  key={notif.id}
                  role="button"
                  tabIndex={0}
                  onPointerDownCapture={event => event.stopPropagation()}
                  onClick={event => { event.stopPropagation(); handleOpen(notif); }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      handleOpen(notif);
                    }
                  }}
                  className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer ${notif.read ? 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700' : 'bg-indigo-950/20 border-indigo-500/30 hover:border-indigo-500/60'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap"><StageBadge stage={notif.stage} size="sm"/>{!notif.read&&<span className="w-2 h-2 rounded-full bg-indigo-500"/>}</div>
                    <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1"><Clock size={10}/>{new Date(notif.sentAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200 line-clamp-1 mb-1">{notif.subject}</h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{notif.body}</p>
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500"><span>To: <span className="text-slate-400">{notif.recipientEmail}</span></span><span className="text-indigo-400 flex items-center gap-0.5">View email <ChevronRight size={12}/></span></div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
