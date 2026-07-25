'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { resolveWsUrl } from '@/lib/ws';

export type WsChatMessage = {
  type: string;
  id: number;
  sender_id: number;
  sender_name: string;
  text: string;
  message_type?: string;
  attachment_url?: string | null;
  created_at: string;
  is_read?: boolean;
  edited_at?: string | null;
  is_deleted?: boolean;
  expires_at?: string | null;
};

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

type Options = {
  conversationId: number | null;
  onMessage: (msg: WsChatMessage) => void;
  onTyping?: (userId: number, isTyping: boolean) => void;
  onConnected?: () => void;
  onReadReceipt?: (messageId: number) => void;
  onEdited?: (msg: WsChatMessage) => void;
  onDeleted?: (messageId: number) => void;
};

export function useChatWebSocket({
  conversationId,
  onMessage,
  onTyping,
  onConnected,
  onReadReceipt,
  onEdited,
  onDeleted,
}: Options) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const generationRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  const onTypingRef = useRef(onTyping);
  const onConnectedRef = useRef(onConnected);
  const onReadReceiptRef = useRef(onReadReceipt);
  const onEditedRef = useRef(onEdited);
  const onDeletedRef = useRef(onDeleted);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onTypingRef.current = onTyping;
    onConnectedRef.current = onConnected;
    onReadReceiptRef.current = onReadReceipt;
    onEditedRef.current = onEdited;
    onDeletedRef.current = onDeleted;
  }, [onMessage, onTyping, onConnected, onReadReceipt, onEdited, onDeleted]);

  useEffect(() => {
    if (!conversationId) {
      setConnected(false);
      return;
    }

    let cancelled = false;
    const generation = ++generationRef.current;
    let socket: WebSocket | null = null;

    void resolveWsUrl('chat', { conversation_id: conversationId }).then((url) => {
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
          if (data.type === 'chat.message') {
            onMessageRef.current(data as WsChatMessage);
          } else if (data.type === 'chat.message_edited') {
            onEditedRef.current?.(data as WsChatMessage);
          } else if (data.type === 'chat.message_deleted') {
            onDeletedRef.current?.(data.id);
          } else if (data.type === 'chat.connected') {
            onConnectedRef.current?.();
          } else if (data.type === 'chat.typing') {
            onTypingRef.current?.(data.user_id, data.is_typing);
          } else if (data.type === 'chat.read') {
            onReadReceiptRef.current?.(data.message_id);
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
  }, [conversationId]);

  const sendMessage = useCallback((text: string, expiresInSeconds?: number | null) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: 'chat.send', text, expires_in_seconds: expiresInSeconds || undefined }));
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
    async (
      file: File,
      messageType?: string,
      onProgress?: (progress: UploadProgress) => void,
    ) => {
      if (!conversationId) return null;
      return new Promise<WsChatMessage | null>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/chat/conversations/${conversationId}/upload/`, true);
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
            resolve(JSON.parse(xhr.responseText) as WsChatMessage);
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
    [conversationId],
  );

  return { connected, sendMessage, sendTyping, uploadFile };
}
