'use client';

import { useState } from 'react';
import { GiftIcon } from '@heroicons/react/24/outline';
import { useLocale } from '@/components/LocaleProvider';
import { sendTip } from '@/lib/tipApi';

type Props = {
  recipientId: number;
  className?: string;
  buttonStyle?: React.CSSProperties;
};

export default function TipButton({ recipientId, className, buttonStyle }: Props) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const handleSend = async () => {
    if (busy || amount <= 0) return;
    setBusy(true);
    setStatus('');
    try {
      const res = await sendTip(recipientId, amount);
      if (res.ok) {
        setStatus(t('tip.sent', { amount: String(amount) }));
        setTimeout(() => {
          setOpen(false);
          setStatus('');
        }, 1500);
      } else {
        setStatus(res.error);
      }
    } catch {
      setStatus(t('tip.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={className ?? 'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold'}
        style={buttonStyle}
      >
        <GiftIcon className="h-4 w-4" />
        {t('tip.send')}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-56 rounded-xl border border-surface bg-background p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-text">{t('tip.pickAmount')}</p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {[10, 50, 100, 500].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setAmount(amt)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  amount === amt ? 'bg-vault text-white' : 'bg-surface text-text-secondary'
                }`}
              >
                {amt} ✨
              </button>
            ))}
          </div>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value, 10) || 0))}
            className="mb-2 w-full rounded-lg border border-surface bg-background px-2 py-1 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-text-secondary"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSend()}
              className="rounded-lg bg-vault px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {busy ? t('common.loading') : t('tip.send')}
            </button>
          </div>
          {status && <p className="mt-2 text-xs text-text-secondary">{status}</p>}
        </div>
      )}
    </div>
  );
}
