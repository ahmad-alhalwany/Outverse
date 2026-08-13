'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveWsUrl } from '@/lib/ws';

export type StudioUser = { id: number; username: string; avatar: string | null };

export type StudioShapeKind = 'rectangle' | 'circle' | 'line';

export type StudioEvent =
  | { type: 'studio.connected'; session_id: number }
  | { type: 'participant.joined'; user: StudioUser }
  | { type: 'participant.left'; user_id: number }
  | { type: 'stroke.added'; id: number; user: StudioUser; points: { x: number; y: number }[]; color: string; width: number }
  | { type: 'stroke.removed'; id: number }
  | { type: 'media.added'; id: number; user: StudioUser; image: string | null; x: number; y: number; width: number; height: number; rotation: number; z_index: number; filter: string }
  | { type: 'media.transformed'; id: number; x: number; y: number; width: number; height: number; rotation: number; filter: string }
  | { type: 'shape.added'; id: number; user: StudioUser; kind: StudioShapeKind; x: number; y: number; width: number; height: number; rotation: number; z_index: number; color: string; stroke_width: number }
  | { type: 'shape.transformed'; id: number; x: number; y: number; width: number; height: number; rotation: number; color: string; stroke_width: number }
  | { type: 'shape.deleted'; id: number }
  | { type: 'text.added'; id: number; user: StudioUser; text: string; x: number; y: number; width: number; height: number; rotation: number; z_index: number; color: string; font_size: number }
  | { type: 'text.transformed'; id: number; text: string; x: number; y: number; width: number; height: number; rotation: number; color: string; font_size: number }
  | { type: 'text.deleted'; id: number }
  | { type: 'media.deleted'; id: number }
  | { type: 'layer.reordered'; kind: 'media' | 'shape' | 'text'; id: number; z_index: number }
  | { type: 'chat.message'; user: StudioUser; text: string }
  | { type: 'cursor.moved'; user_id: number; x: number; y: number }
  | { type: 'session.cleared' };

type Options = {
  sessionId: number | null;
  onEvent?: (event: StudioEvent) => void;
};

/** Live strokes, media, cursors and presence for one Creation Studio session. */
export function useStudioSocket({ sessionId, onEvent }: Options) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!sessionId) {
      setConnected(false);
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;

    void resolveWsUrl('studio', { session_id: sessionId }).then((url) => {
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
          const data = JSON.parse(ev.data as string) as StudioEvent;
          if (data?.type) onEventRef.current?.(data);
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
  }, [sessionId]);

  const send = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

  return { connected, send };
}
