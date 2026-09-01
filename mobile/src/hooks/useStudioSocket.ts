import { useCallback, useEffect, useRef, useState } from 'react';
import { getWsToken, wsUrl } from '@/api/ws';

export type StudioSocketEvent = { type: string; [key: string]: unknown };

type Options = {
  sessionId: number | null;
  onEvent?: (event: StudioSocketEvent) => void;
};

export function useStudioSocket({ sessionId, onEvent }: Options) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!sessionId) {
      setConnected(false);
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;

    void (async () => {
      const token = await getWsToken();
      if (cancelled) return;
      const ws = new WebSocket(wsUrl(`/ws/studio/${sessionId}/`, token));
      socket = ws;
      wsRef.current = ws;
      ws.onopen = () => {
        if (!cancelled) setConnected(true);
      };
      ws.onclose = () => {
        if (!cancelled) setConnected(false);
      };
      ws.onerror = () => {
        ws.close();
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as StudioSocketEvent;
          if (data?.type) onEventRef.current?.(data);
        } catch {
          /* ignore malformed frames */
        }
      };
    })();

    return () => {
      cancelled = true;
      socket?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [sessionId]);

  const send = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return false;
    wsRef.current.send(JSON.stringify({ type, ...payload }));
    return true;
  }, []);

  return { connected, send };
}
