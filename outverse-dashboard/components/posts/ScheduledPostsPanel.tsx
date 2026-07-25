'use client';

import { useEffect, useState } from 'react';
import { ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useLocale } from '@/components/LocaleProvider';
import { cancelScheduledPost, fetchScheduledPosts, type ScheduledPost } from '@/lib/scheduledPostsApi';

const STATUS_LABEL_KEY: Record<ScheduledPost['status'], string> = {
  pending: 'compose.scheduledStatusPending',
  published: 'compose.scheduledStatusPublished',
  failed: 'compose.scheduledStatusFailed',
  canceled: 'compose.scheduledStatusCanceled',
};

export default function ScheduledPostsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocale();
  const [items, setItems] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelingId, setCancelingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchScheduledPosts()
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        if (!cancelled) setError(t('compose.scheduledLoadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  async function handleCancel(id: number) {
    setCancelingId(id);
    const ok = await cancelScheduledPost(id);
    if (ok) {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'canceled' } : item)));
    } else {
      setError(t('compose.scheduledCancelError'));
    }
    setCancelingId(null);
  }

  if (!open) return null;

  const pending = items.filter((item) => item.status === 'pending');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-background border border-surface p-5 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 font-semibold text-text">
            <ClockIcon className="h-5 w-5" />
            {t('compose.scheduledPanelTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-1 rounded-full text-text-secondary hover:text-red-500 hover:bg-surface"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-text-secondary text-center py-6">{t('common.loading')}</p>
        ) : error ? (
          <p className="text-sm text-red-500 text-center py-6">{error}</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-6">{t('compose.scheduledEmpty')}</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((item) => (
              <li key={item.id} className="rounded-xl border border-surface bg-surface/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-text truncate">{item.payload.text}</p>
                    <p className="text-xs text-text-secondary mt-1">
                      {new Date(item.publish_at).toLocaleString()} · {t(STATUS_LABEL_KEY[item.status])}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCancel(item.id)}
                    disabled={cancelingId === item.id}
                    className="shrink-0 text-xs font-semibold text-red-500 hover:underline disabled:opacity-50"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
