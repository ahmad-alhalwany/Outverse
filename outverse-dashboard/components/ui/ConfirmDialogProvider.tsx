'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type PendingConfirm = {
  message: string;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fall back to the native dialog if a page renders outside the provider
    // (shouldn't happen once mounted at the root layout).
    return (message: string) => Promise.resolve(window.confirm(message));
  }
  return ctx;
}

export default function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((message, options = {}) => {
    return new Promise<boolean>((resolve) => {
      const next = { message, options, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    pendingRef.current?.resolve(value);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const contextValue = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={contextValue}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/50 p-4"
          onClick={() => settle(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-surface bg-background p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {pending.options.title && (
              <h2 className="text-base font-bold">{pending.options.title}</h2>
            )}
            <p className="text-sm text-text-secondary">{pending.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => settle(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-text-secondary"
              >
                {pending.options.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => settle(true)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${pending.options.danger ? 'bg-red-600' : 'bg-vault'}`}
                autoFocus
              >
                {pending.options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
