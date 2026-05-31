'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { wsUrl } from '@/lib/ws';

export type WsChatMessage = {
  type: string;
  id: number;
  sender_id: number;
  sender_name: string;
  text: string;
  message_type?: string;
  attachment_url?: string | null;
  created_at: string;
};

type Options = {
  conversationId: number | null;
  onMessage: (msg: WsChatMessage) => void;
  onTyping?: (userId: number, isTyping: boolean) => void;
  onConnected?: () => void;
};

export function useChatWebSocket({
  conversationId,
  onMessage,
  onTyping,
  onConnected,
}: Options) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onTypingRef = useRef(onTyping);
  const onConnectedRef = useRef(onConnected);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onTypingRef.current = onTyping;
    onConnectedRef.current = onConnected;
  }, [onMessage, onTyping, onConnected]);

  useEffect(() => {
    if (!conversationId) {
      setConnected(false);
      return;
    }

    const url = wsUrl(`/ws/chat/${conversationId}/`);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'chat.message') {
          onMessageRef.current(data as WsChatMessage);
        } else if (data.type === 'chat.connected') {
          onConnectedRef.current?.();
        } else if (data.type === 'chat.typing') {
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
  }, [conversationId]);

  const sendMessage = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: 'chat.send', text }));
    return true;
  }, []);

  const sendTyping = useCallback(
    async (isTyping: boolean) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'chat.typing', is_typing: isTyping }));
        return;
      }
      if (!conversationId) return;
      try {
        await apiFetch(`chat/conversations/${conversationId}/typing/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_typing: isTyping }),
        });
      } catch {
        /* ignore */
      }
    },
    [conversationId],
  );

  const uploadFile = useCallback(
    async (file: File, messageType?: string) => {
      if (!conversationId) return null;
      const form = new FormData();
      form.append('file', file);
      if (messageType) form.append('message_type', messageType);
      const res = await apiFetch(
        `chat/conversations/${conversationId}/upload/`,
        { method: 'POST', body: form },
      );
      if (!res.ok) return null;
      return res.json() as Promise<WsChatMessage>;
    },
    [conversationId],
  );

  return { connected, sendMessage, sendTyping, uploadFile };
}
