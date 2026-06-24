'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { resolveWsUrl, type UploadProgress } from '@/lib/ws';

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
  const generationRef = useRef(0);
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

    let cancelled = false;
    const generation = ++generationRef.current;
    let socket: WebSocket | null = null;

    void resolveWsUrl('room', { room_id: roomId }).then((url) => {
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
    });

    return () => {
      cancelled = true;
      if (wsRef.current === socket) {
        wsRef.current = null;
      }
      socket?.close();
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
    async (
      file: File,
      messageType?: string,
      onProgress?: (progress: UploadProgress) => void,
    ) => {
      if (!roomId) return null;
      return new Promise<WsRoomMessage | null>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/chat/rooms/${roomId}/upload/`, true);
        xhr.withCredentials = true;
        const token = localStorage.getItem('token');
        if (token) {
          xhr.setRequestHeader('Authorization', `Token ${token}`);
        }
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          onProgress?.({
            loaded: event.loaded,
            total: event.total,
            percent: Math.round((event.loaded / event.total) * 100),
          });
        };
        xhr.onload = () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            resolve(null);
            return;
          }
          try {
            resolve(JSON.parse(xhr.responseText) as WsRoomMessage);
          } catch {
            resolve(null);
          }
        };
        xhr.onerror = () => resolve(null);
        const form = new FormData();
        form.append('file', file);
        if (messageType) form.append('message_type', messageType);
        xhr.send(form);
      });
    },
    [roomId],
  );

  return { connected, sendMessage, sendTyping, uploadFile };
}
