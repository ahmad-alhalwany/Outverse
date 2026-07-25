'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveWsUrl } from '@/lib/ws';

export type LiveNotification = {
  type: 'notification.new';
  id: number;
  verb: string;
  text: string;
  post?: number | null;
  reel?: number | null;
  story?: number | null;
  idea?: number | null;
  actor_id?: number | null;
  actor?: { id: number; username: string; avatar: string | null } | null;
  is_read?: boolean;
  created_at?: string;
};

type Options = {
  enabled?: boolean;
  onNotification?: (payload: LiveNotification) => void;
};

/** Subscribe to live notifications via the dedicated notifications WebSocket. */
export function useLiveNotifications({ enabled = true, onNotification }: Options) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onNotificationRef = useRef(onNotification);

  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;

    void resolveWsUrl('notifications').then((url) => {
      if (cancelled) return;
      const ws = new WebSocket(url);
      socket = ws;
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) setConnected(true);
      };
      ws.onclose = () => {
        if (!cancelled) setConnected(false);
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data as string) as LiveNotification;
          if (data?.type === 'notification.new') {
            onNotificationRef.current?.(data);
          }
        } catch {
          /* ignore */
        }
      };
    });

    return () => {
      cancelled = true;
      socket?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [enabled]);

  const ping = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'presence.ping' }));
  }, []);

  return { connected, ping };
}
