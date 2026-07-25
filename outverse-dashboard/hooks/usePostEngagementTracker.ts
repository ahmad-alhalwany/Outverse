'use client';

import { useEffect, useRef } from 'react';
import { trackEngagement } from '@/lib/engagementTracker';

export function usePostEngagementTracker(
  postId?: number,
  authorId?: number,
  onVisible?: () => void,
) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const viewSent = useRef(false);
  const dwell3Sent = useRef(false);
  const dwell10Sent = useRef(false);
  const dwell3Timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dwell10Timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !postId || !authorId) return;

    const clearDwellTimers = () => {
      if (dwell3Timer.current) {
        clearTimeout(dwell3Timer.current);
        dwell3Timer.current = null;
      }
      if (dwell10Timer.current) {
        clearTimeout(dwell10Timer.current);
        dwell10Timer.current = null;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.45);
        if (!visible) {
          clearDwellTimers();
          return;
        }

        if (!viewSent.current) {
          viewSent.current = true;
          onVisible?.();
          trackEngagement({
            content_type: 'post',
            content_id: postId,
            author_id: authorId,
            event_type: 'view',
          });
        }

        if (!dwell3Sent.current && !dwell3Timer.current) {
          dwell3Timer.current = setTimeout(() => {
            dwell3Sent.current = true;
            trackEngagement({
              content_type: 'post',
              content_id: postId,
              author_id: authorId,
              event_type: 'dwell_3s',
            });
          }, 3000);
        }

        if (!dwell10Sent.current && !dwell10Timer.current) {
          dwell10Timer.current = setTimeout(() => {
            dwell10Sent.current = true;
            trackEngagement({
              content_type: 'post',
              content_id: postId,
              author_id: authorId,
              event_type: 'dwell_10s',
            });
          }, 10000);
        }
      },
      { threshold: [0.45, 0.6] },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearDwellTimers();
    };
  }, [postId, authorId, onVisible]);

  return cardRef;
}
