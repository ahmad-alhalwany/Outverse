'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

type Props = {
  message: string;
  undoLabel: string;
  busy?: boolean;
  onUndo: () => void;
  onDismiss?: () => void;
  /** Auto-close the toast (post stays hidden). Default 10s. */
  autoDismissMs?: number;
};

/** Compact bottom snackbar with Undo — used after hide / not interested / see less. */
export default function FeedUndoToast({
  message,
  undoLabel,
  busy = false,
  onUndo,
  onDismiss,
  autoDismissMs = 10000,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!autoDismissMs || !onDismiss) return;
    const t = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(t);
  }, [autoDismissMs, onDismiss]);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[95] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-white/10 px-4 py-3 shadow-2xl"
        style={{
          background: 'rgba(30, 23, 64, 0.96)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <p className="min-w-0 flex-1 text-sm text-white/90">{message}</p>
        <button
          type="button"
          onClick={onUndo}
          disabled={busy}
          className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold text-violet-300 transition hover:bg-white/10 disabled:opacity-60"
        >
          {busy ? '…' : undoLabel}
        </button>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-full px-2 py-1 text-sm text-white/50 hover:bg-white/10 hover:text-white/80"
            aria-label="Close"
          >
            ×
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
