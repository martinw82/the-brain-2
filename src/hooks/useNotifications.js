import { notifications as notificationsApi } from '../api.js';

/**
 * Hook for notification operations.
 */
export default function useNotifications(deps) {
  const {
    notifications,
    setNotifications,
    setUnreadCount,
    setNotificationsLoading,
  } = deps;

  const loadNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const data = await notificationsApi.list();
      if (data && data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (e) {
      console.error('Notifications load error:', e);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const checkNotificationTriggers = async () => {
    try {
      await notificationsApi.checkTriggers();
      await loadNotifications();
    } catch (e) {
      console.error('Notification trigger check error:', e);
    }
  };

  const markNotificationRead = async (id) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Mark read error:', e);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Mark all read error:', e);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await notificationsApi.delete(id);
      const wasUnread = notifications.find((n) => n.id === id && !n.read);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Delete notification error:', e);
    }
  };

  return {
    loadNotifications,
    checkNotificationTriggers,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
  };
}
