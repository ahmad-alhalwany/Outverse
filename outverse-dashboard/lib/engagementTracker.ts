import { apiFetchJson } from './api';
import { getUser } from './auth';

export type EngagementContentType = 'post' | 'reel' | 'story';

export type EngagementEventType =
  | 'view'
  | 'dwell_3s'
  | 'dwell_10s'
  | 'like'
  | 'comment'
  | 'share'
  | 'save'
  | 'repost'
  | 'hide';

export interface EngagementEvent {
  content_type: EngagementContentType;
  content_id: number;
  author_id: number;
  event_type: EngagementEventType;
  metadata?: Record<string, unknown>;
}

const queue: EngagementEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushEngagementEvents();
  }, 2000);
}

export function trackEngagement(event: EngagementEvent) {
  if (!getUser()) return;
  queue.push(event);
  scheduleFlush();
}

export async function flushEngagementEvents() {
  if (flushing || !queue.length || !getUser()) return;
  flushing = true;
  const batch = queue.splice(0, 50);
  try {
    await apiFetchJson('analytics/events/', {
      method: 'POST',
      json: { events: batch },
    });
  } catch {
    queue.unshift(...batch);
  } finally {
    flushing = false;
    if (queue.length) scheduleFlush();
  }
}
