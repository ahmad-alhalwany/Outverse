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

function subscribe(callback: () => void) {
  timerListeners.add(callback);
  if (timerId == null && typeof window !== 'undefined') {
    timerId = window.setInterval(() => {
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

function getSnapshot() {
  return Date.now();
}

export default function RelativeTime({ date, locale = 'en', className, style }: Props) {
  useSyncExternalStore(subscribe, getSnapshot, () => 0);
  const label = typeof window === 'undefined' ? '' : formatRelativeTime(date, locale);

  return (
    <span className={className} style={style} suppressHydrationWarning>
      {label || '\u00a0'}
    </span>
  );
}
