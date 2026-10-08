import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { Mail, X, Bell, Clock, ChevronRight, ArrowLeft, Trash2 } from 'lucide-react';
import { StageBadge } from './Badge';

export function NotificationDrawer({ isOpen, onClose, onRefreshCount }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState(null);

  const listRef = useRef(null);
  const listScrollTopRef = useRef(0);

  const syncCount = list => {
    onRefreshCount?.(list.filter(notification => !notification.read).length);
  };

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const res = await api.notifications.getAll();
      const list = res.notifications || [];
      setNotifications(list);
      syncCount(list);
    } catch (err) {
      console.warn('Could not fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSelectedNotif(null);
      return;
    }
    fetchNotifs();
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || selectedNotif || !listRef.current) return;
    listRef.current.scrollTop = listScrollTopRef.current;
  }, [isOpen, selectedNotif, notifications]);

  const handleOpen = notif => {
    if (listRef.current) {
      listScrollTopRef.current = listRef.current.scrollTop;
    }

    // Open immediately. The server read operation is persisted independently.
    const selected = { ...notif, read: true };
    setSelectedNotif(selected);

    setNotifications(prev => {
      const next = prev.map(item => item.id === notif.id ? { ...item, read: true } : item);
      syncCount(next);
      return next;
    });

    if (!notif.read) {
      void api.notifications.markAsRead(notif.id).catch(err => {
        console.warn('Could not mark notification as read:', err);
        // Reconcile with the server if the optimistic read could not be persisted.
        void fetchNotifs();
      });
    }
  };

  const handleBackToList = () => {
    setSelectedNotif(null);
  };

  const handleRemove = async (event, notif) => {
    event.stopPropagation();

    try {
      await api.notifications.remove(notif.id);

      setNotifications(prev => {
        const next = prev.filter(item => item.id !== notif.id);
        syncCount(next);
        return next;
      });

      if (selectedNotif?.id === notif.id) {
        setSelectedNotif(null);
      }
    } catch (err) {
      console.warn('Could not remove notification:', err);
      void fetchNotifs();
    }
  };

  const handleClearAll = async () => {
    if (notifications.length === 0) return;

    try {
      await api.notifications.clearAll();
      setNotifications([]);
      setSelectedNotif(null);
      onRefreshCount?.(0);
      listScrollTopRef.current = 0;
    } catch (err) {
      console.warn('Could not clear notifications:', err);
      void fetchNotifs();
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
                <button
                  type="button"
                  onClick={handleBackToList}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
                  aria-label="Back to notifications"
                  title="Back to notifications"
                >
                  <ArrowLeft size={16}/>
                </button>
                <div>
                  <h3 className="font-semibold text-slate-100 text-sm">Email Message</h3>
                  <p className="text-[11px] text-slate-400">Notification details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
                aria-label="Close notifications"
                title="Close"
              >
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
            <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={event => handleRemove(event, selectedNotif)}
                className="px-3.5 py-2 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold flex items-center gap-1.5"
              >
                <Trash2 size={13}/>
                Remove
              </button>
              <button
                type="button"
                onClick={handleBackToList}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold"
              >
                Back to notifications
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Mail size={16}/>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-100 text-sm">Notifications</h3>
                  <p className="text-[11px] text-slate-400">Email and status messages</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
                  aria-label="Close notifications"
                  title="Close"
                >
                  <X size={18}/>
                </button>
              </div>
            </div>

            <div
              ref={listRef}
              onScroll={event => {
                listScrollTopRef.current = event.currentTarget.scrollTop;
              }}
              className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3"
            >
              {loading ? (
                <div className="text-center py-12 text-slate-500 text-xs">Loading notifications...</div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs flex flex-col items-center gap-2">
                  <Bell size={24} className="text-slate-600"/>
                  <span>No notifications yet.</span>
                </div>
              ) : (
                notifications.map(notif => (
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <StageBadge stage={notif.stage} size="sm"/>
                        {!notif.read && <span className="w-2 h-2 rounded-full bg-indigo-500"/>}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <Clock size={10}/>{new Date(notif.sentAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                        </span>
                        <button
                          type="button"
                          onClick={event => handleRemove(event, notif)}
                          className="p-1 rounded-md text-slate-500 hover:text-rose-300 hover:bg-rose-500/10"
                          aria-label={`Remove notification: ${notif.subject}`}
                          title="Remove notification"
                        >
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    </div>
                    <h4 className="text-xs font-semibold text-slate-200 line-clamp-1 mb-1">{notif.subject}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{notif.body}</p>
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                      <span>To: <span className="text-slate-400">{notif.recipientEmail}</span></span>
                      <span className="text-indigo-400 flex items-center gap-0.5">View email <ChevronRight size={12}/></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
