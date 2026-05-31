'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { wsUrl } from '@/lib/ws';

export type SignalPayload = Record<string, unknown> & { type: string };

type Options = {
  enabled?: boolean;
  onSignal: (payload: SignalPayload) => void;
};

export function useSignalWebSocket({ enabled = true, onSignal }: Options) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onSignalRef = useRef(onSignal);

  useEffect(() => {
    onSignalRef.current = onSignal;
  }, [onSignal]);

  useEffect(() => {
    if (!enabled) return;

    const url = wsUrl('/ws/signal/');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as SignalPayload;
        onSignalRef.current(data);
      } catch {
        /* ignore */
      }
    };

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'presence.ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(ping);
      ws.close();
      wsRef.current = null;
    };
  }, [enabled]);

  const sendSignal = useCallback((payload: SignalPayload) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  const joinRoom = useCallback(
    (roomId: number) => {
      return sendSignal({ type: 'room.join', room_id: roomId });
    },
    [sendSignal],
  );

  const leaveRoom = useCallback(
    (roomId: number) => {
      return sendSignal({ type: 'room.leave', room_id: roomId });
    },
    [sendSignal],
  );

  return { connected, sendSignal, joinRoom, leaveRoom };
}
