'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { wsUrl } from '@/lib/ws';

export type WsRoomMessage = {
  type: string;
  id: number;
  room_id: number;
  sender_id: number;
  sender_name: string;
  text: string;
  message_type?: string;
  attachment_url?: string | null;
  created_at: string;
};

type Options = {
  roomId: number | null;
  onMessage: (msg: WsRoomMessage) => void;
  onTyping?: (userId: number, isTyping: boolean) => void;
};

export function useRoomWebSocket({
  roomId,
  onMessage,
  onTyping,
}: Options) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onTypingRef = useRef(onTyping);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onTypingRef.current = onTyping;
  }, [onMessage, onTyping]);

  useEffect(() => {
    if (!roomId) {
      setConnected(false);
      return;
    }

    const url = wsUrl(`/ws/room/${roomId}/`);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'room.message') {
          onMessageRef.current(data as WsRoomMessage);
        } else if (data.type === 'room.typing') {
          onTypingRef.current?.(data.user_id, data.is_typing);
        }
      } catch {
        /* ignore */
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [roomId]);

  const sendMessage = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: 'room.send', text }));
    return true;
  }, []);

  const sendTyping = useCallback(
    async (isTyping: boolean) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'room.typing', is_typing: isTyping }));
        return;
      }
      if (!roomId) return;
      try {
        await apiFetch(`chat/rooms/${roomId}/typing/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_typing: isTyping }),
        });
      } catch {
        /* ignore */
      }
    },
    [roomId],
  );

  const uploadFile = useCallback(
    async (file: File, messageType?: string) => {
      if (!roomId) return null;
      const form = new FormData();
      form.append('file', file);
      if (messageType) form.append('message_type', messageType);
      const res = await apiFetch(`chat/rooms/${roomId}/upload/`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) return null;
      return res.json() as Promise<WsRoomMessage>;
    },
    [roomId],
  );

  return { connected, sendMessage, sendTyping, uploadFile };
}
