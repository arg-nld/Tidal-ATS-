import { store } from '../services/store.js';

export function getNotifications(req, res) {
  const isHr = req.user && req.user.role === 'hr';

  if (isHr) {
    const notifs = store.getNotifications();
    return res.json({ notifications: notifs });
  }

  if (!req.user || !req.user.email) {
    return res.status(401).json({ error: 'Please sign in to view notifications' });
  }

  const notifs = store.getNotificationsForUser(req.user);
  return res.json({ notifications: notifs });
}

export function markAsRead(req, res) {
  const { id } = req.params;
  const owned = store.getNotificationsForUser(req.user).find(item => item.id === id);
  if (!owned) return res.status(404).json({ error: 'Notification not found' });

  const notif = store.markNotificationAsRead(id);

  return res.json({ notification: notif });
}
