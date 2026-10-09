import { store } from '../services/store.js';
import { parsePagination, paginateArray } from '../middleware/pagination.js';
import { sendEmail } from '../services/emailService.js';

export async function getNotifications(req, res) {
  if (!req.user) {
    return res.status(401).json({ error: 'Please sign in to view notifications' });
  }

  // Notifications are always scoped to the authenticated user.
  // The frontend never supplies a user ID or role for this decision.
  const notifs = await store.getNotificationsForUser(req.user);
  const page = paginateArray(notifs, parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 }));
  return res.json({ notifications: page.items, ...(page.meta ? { pagination: page.meta } : {}) });
}

export async function markAsRead(req, res) {
  const { id } = req.params;
  const owned = (await store.getNotificationsForUser(req.user)).find(item => item.id === id);
  if (!owned) return res.status(404).json({ error: 'Notification not found' });

  const notif = await store.markNotificationAsRead(id, req.user);

  return res.json({ notification: notif });
}

export async function deleteNotification(req, res) {
  const { id } = req.params;
  const deleted = await store.deleteNotificationForUser(id, req.user);

  if (!deleted) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  return res.json({
    notification: deleted,
    message: 'Notification removed successfully.'
  });
}

export async function clearNotifications(req, res) {
  const deletedCount = await store.clearNotificationsForUser(req.user);

  return res.json({
    deletedCount,
    message: deletedCount
      ? `Cleared ${deletedCount} notification${deletedCount === 1 ? '' : 's'}.`
      : 'There were no notifications to clear.'
  });
}

export async function retryEmail(req, res) {
  const { id } = req.params;
  const notification = (await store.getNotificationsForUser(req.user)).find(item => item.id === id);
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  if (notification.deliveryStatus === 'sent') return res.status(409).json({ error: 'This notification email was already delivered.' });
  if (!notification.recipientEmail) return res.status(400).json({ error: 'Notification has no recipient email address.' });

  try {
    const providerResult = await sendEmail({
      to: notification.recipientEmail,
      subject: notification.subject,
      body: notification.body,
      idempotencyKey: `notification-retry/${notification.id}/${Date.now()}`
    });
    const updated = await store.updateNotification(notification.id, {
      deliveryStatus: 'sent',
      deliveryError: null,
      providerMessageId: providerResult?.id || null
    });
    return res.json({ notification: updated, message: 'Notification email was sent successfully.' });
  } catch (err) {
    const updated = await store.updateNotification(notification.id, {
      deliveryStatus: 'failed',
      deliveryError: err?.message || 'Email delivery failed.'
    });
    return res.status(503).json({
      error: 'The notification email could not be delivered after retrying. The failure was recorded for follow-up.',
      notification: updated
    });
  }
}
