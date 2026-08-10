'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';

export const REPORT_REASONS = [
  { value: 'spam', labelKey: 'social.reportReasonSpam' },
  { value: 'harassment', labelKey: 'social.reportReasonHarassment' },
  { value: 'impersonation', labelKey: 'social.reportReasonImpersonation' },
  { value: 'hate', labelKey: 'social.reportReasonHate' },
  { value: 'other', labelKey: 'social.reportReasonOther' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (reason: ReportReason, details: string) => Promise<boolean>;
};

/** Modal to pick a report reason before sending to moderators. */
export default function ReportDialog({ open, onClose, title, onSubmit }: Props) {
  const { t } = useLocale();
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setReason('spam');
    setDetails('');
    setError('');
    setBusy(false);
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const ok = await onSubmit(reason, details.trim());
      if (ok) onClose();
      else setError(t('common.actionFailed'));
    } catch {
      setError(t('common.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label={t('social.reportCancel')}
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--surface,#1E1740)] p-5 shadow-2xl">
        <p className="mb-3 text-base font-semibold text-text">{title}</p>
        <div className="mb-3 space-y-1">
          {REPORT_REASONS.map((r) => (
            <label
              key={r.value}
              className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-text hover:bg-white/5"
            >
              <input
                type="radio"
                name="report-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
              />
              <span>{t(r.labelKey as never)}</span>
            </label>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder={t('social.reportDetailsPlaceholder')}
          rows={3}
          className="mb-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-text placeholder:text-muted"
        />
        {error ? <p className="mb-2 text-xs text-red-400">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full px-4 py-2 text-sm font-semibold text-muted hover:bg-white/5"
          >
            {t('social.reportCancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-full px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/15 disabled:opacity-60"
          >
            {busy ? '…' : t('social.reportSubmit')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function reportReasonLabel(
  reason: string,
  t: (key: never) => string,
): string {
  const found = REPORT_REASONS.find((r) => r.value === reason);
  return found ? t(found.labelKey as never) : reason;
}
