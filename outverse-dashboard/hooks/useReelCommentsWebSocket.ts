'use client';

import { useEffect, useRef } from 'react';
import { wsUrl } from '@/lib/ws';

export type ReelCommentWsPayload = {
  type: 'comment.update';
  action?: string;
  comment_id?: number;
  comment?: Record<string, unknown>;
};

type Options = {
  reelId: number | null;
  open?: boolean;
  onUpdate?: (payload?: ReelCommentWsPayload) => void;
};

export function useReelCommentsWebSocket({ reelId, open = true, onUpdate }: Options) {
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (!reelId || !open) return;
    const url = wsUrl(`/ws/reels/${reelId}/comments/`);
    const ws = new WebSocket(url);

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as ReelCommentWsPayload;
        if (data?.type === 'comment.update') {
          onUpdateRef.current?.(data);
        }
      } catch {
        /* ignore */
      }
    };

    return () => ws.close();
  }, [reelId, open]);
}
