'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveWsUrl } from '@/lib/ws';

export type SignalPayload = Record<string, unknown> & { type: string };

type Options = {
  enabled?: boolean;
  onSignal: (payload: SignalPayload) => void;
};

export function useSignalWebSocket({ enabled = true, onSignal }: Options) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const generationRef = useRef(0);
  const onSignalRef = useRef(onSignal);

  useEffect(() => {
    onSignalRef.current = onSignal;
  }, [onSignal]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const generation = ++generationRef.current;
    let socket: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;

    void resolveWsUrl('signal').then((url) => {
      if (cancelled || generationRef.current !== generation) return;
      const ws = new WebSocket(url);
      socket = ws;
      wsRef.current = ws;

      ws.onopen = () => {
        if (generationRef.current !== generation || wsRef.current !== ws) return;
        setConnected(true);
      };
      ws.onclose = () => {
        if (generationRef.current !== generation || wsRef.current !== ws) return;
        setConnected(false);
      };
      ws.onerror = () => {
        if (generationRef.current !== generation || wsRef.current !== ws) return;
        setConnected(false);
      };

      ws.onmessage = (ev) => {
        if (generationRef.current !== generation || wsRef.current !== ws) return;
        try {
          const data = JSON.parse(ev.data) as SignalPayload;
          onSignalRef.current(data);
        } catch {
          /* ignore */
        }
      };

      ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'presence.ping' }));
        }
      }, 30000);
    });

    return () => {
      cancelled = true;
      if (ping) clearInterval(ping);
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
      socket?.close();
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
