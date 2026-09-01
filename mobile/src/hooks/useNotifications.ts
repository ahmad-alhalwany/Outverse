import { useState, useCallback, useEffect } from 'react';
import api from '../api/client';
import type { Notification, PaginatedResponse } from '../types';

export function useNotifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async (unreadOnly = false) => {
    setLoading(true);
    try {
      const data: PaginatedResponse<Notification> = await api.getNotifications({
        unread_only: unreadOnly,
      });
      setItems(data.results || []);
      setUnreadCount((data.results || []).filter((n) => !n.is_read).length);
    } catch (e: any) {
      setError(e?.message || 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const markAllRead = useCallback(async () => {
    try {
      await api.markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { items, loading, error, unreadCount, refreshing, load, refresh, markAllRead, markRead };
}
