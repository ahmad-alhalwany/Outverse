'use client';

import { useSyncExternalStore, type CSSProperties } from 'react';
import { formatRelativeTime } from '@/utils/dateFormatter';

type Props = {
  date: Date | string;
  locale?: 'ar' | 'en';
  className?: string;
  style?: CSSProperties;
};

let timerListeners = new Set<() => void>();
let timerId: number | null = null;
let lastTick = 0;

function subscribe(callback: () => void) {
  timerListeners.add(callback);
  if (timerId == null && typeof window !== 'undefined') {
    timerId = window.setInterval(() => {
      lastTick = Date.now();
      timerListeners.forEach((listener) => listener());
    }, 60_000);
  }
  return () => {
    timerListeners.delete(callback);
    if (timerListeners.size === 0 && timerId != null) {
      window.clearInterval(timerId);
      timerId = null;
    }
  };
}

// Stable across renders — only advances when the shared interval actually
// ticks, so useSyncExternalStore doesn't see a "changing" snapshot every render.
function getSnapshot() {
  return lastTick;
}

export default function RelativeTime({ date, locale = 'en', className, style }: Props) {
  useSyncExternalStore(subscribe, getSnapshot, () => 0);
  const label = typeof window === 'undefined' ? '' : formatRelativeTime(date, locale);
  const absolute = (() => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (Number.isNaN(d.getTime())) return undefined;
      return d.toLocaleString(locale === 'ar' ? 'ar' : 'en', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return undefined;
    }
  })();

  return (
    <span className={className} style={style} title={absolute} suppressHydrationWarning>
      {label || '\u00a0'}
    </span>
  );
}
