'use client';

import { useEffect, useRef } from 'react';
import { wsUrl } from '@/lib/ws';

export type CommentWsPayload = {
  type: 'comment.update';
  action?: string;
  comment_id?: number;
  comment?: Record<string, unknown>;
};

type Options = {
  postId: number | null;
  open?: boolean;
  onUpdate?: (payload?: CommentWsPayload) => void;
};

/** Live comment thread updates for an open post. */
export function usePostCommentsWebSocket({ postId, open = true, onUpdate }: Options) {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!postId || !open) return;

    let socket: WebSocket | null = null;
    const url = wsUrl(`/ws/posts/${postId}/comments/`);
    const ws = new WebSocket(url);
    socket = ws;

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as CommentWsPayload;
        if (data?.type === 'comment.update') {
          onUpdateRef.current?.(data);
        }
      } catch {
        /* ignore */
      }
    };

    return () => {
      socket?.close();
    };
  }, [postId, open]);
}
