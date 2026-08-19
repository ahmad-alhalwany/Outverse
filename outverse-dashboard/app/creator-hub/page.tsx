'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { SparklesIcon, PlusIcon, TrashIcon, PlayCircleIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import CosmicVideoPlayer from '@/components/CosmicVideoPlayer';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import { useLocale } from '@/components/LocaleProvider';
import {
  fetchMyTiers,
  createCreatorTier,
  updateCreatorTier,
  deleteCreatorTier,
  fetchMySubscribers,
  type CreatorTier,
  type SubscribersSummary,
} from '@/lib/creatorSubscriptionsApi';
import { apiFetchJson, mediaUrl } from '@/lib/api';

const MAX_TIERS = 3;

type VodItem = {
  id: number;
  title?: string;
  recording_url?: string;
  ended_at?: string | null;
  peak_viewers?: number;
};

export default function CreatorHubPage() {
  const confirm = useConfirm();
  const { t } = useLocale();
  const [tiers, setTiers] = useState<CreatorTier[]>([]);
  const [summary, setSummary] = useState<SubscribersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceUsd, setPriceUsd] = useState('4.99');
  const [createBusy, setCreateBusy] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [vods, setVods] = useState<VodItem[]>([]);
  const [expandedVodId, setExpandedVodId] = useState<number | null>(null);

  const activeTierCount = tiers.filter((tier) => tier.is_active).length;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [tiersRes, subsRes, vodRes] = await Promise.all([
        fetchMyTiers(),
        fetchMySubscribers(),
        apiFetchJson('live/vods/?mine=1&limit=20', { method: 'GET' }),
      ]);
      setTiers(tiersRes);
      setSummary(subsRes);
      if (vodRes.ok) {
        const data = await vodRes.json().catch(() => null);
        const list = Array.isArray(data) ? data : data?.results;
        setVods(Array.isArray(list) ? list : []);
      } else {
        setVods([]);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    const cents = Math.round(parseFloat(priceUsd || '0') * 100);
    if (!trimmedName || !cents || cents < 100 || createBusy) return;
    setCreateBusy(true);
    setError('');
    try {
      const res = await createCreatorTier(trimmedName, description.trim(), cents);
      if (res.ok) {
        setName('');
        setDescription('');
        setPriceUsd('4.99');
        setCreating(false);
        void load();
      } else {
        setError(res.error || t('creatorHub.createTierError'));
      }
    } finally {
      setCreateBusy(false);
    }
  };

  const handleToggleActive = async (tier: CreatorTier) => {
    setActionError('');
    const res = await updateCreatorTier(tier.id, { is_active: !tier.is_active });
    if (res.ok) void load();
    else setActionError(res.error || t('creatorHub.toggleTierError'));
  };

  const handleDelete = async (tier: CreatorTier) => {
    if (!(await confirm(t('creatorHub.confirmDeleteTier', { name: tier.name }), { danger: true, confirmLabel: t('common.delete') }))) return;
    setActionError('');
    const res = await deleteCreatorTier(tier.id);
    if (res.ok) void load();
    else setActionError(res.error || t('creatorHub.deleteTierError'));
  };

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-2xl mx-auto px-4 pb-16">
      <div className="pt-4 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SparklesIcon className="h-6 w-6" />
            {t('creatorHub.title')}
          </h1>
          <div className="flex gap-2">
            <Link href="/videos" className="rounded-full border border-surface px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-vault">
              {t('creatorHub.videos')}
            </Link>
            <Link href="/playlists" className="rounded-full border border-surface px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-vault">
              {t('creatorHub.playlists')}
            </Link>
          </div>
        </div>

        {actionError && (
          <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
            {actionError}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-text-secondary py-8 text-center">{t('creatorHub.loading')}</p>
        ) : loadError ? (
          <div className="rounded-2xl border border-surface bg-surface/40 p-8 text-center">
            <p className="text-sm text-text-secondary mb-3">{t('creatorHub.loadError')}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-full bg-vault px-4 py-1.5 text-xs font-semibold text-white"
            >
              {t('creatorHub.retry')}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-surface bg-surface/40 p-4">
                <p className="text-xs text-text-secondary">{t('creatorHub.subscribers')}</p>
                <p className="text-2xl font-bold">{summary?.subscriber_count ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-surface bg-surface/40 p-4">
                <p className="text-xs text-text-secondary">{t('creatorHub.novaEarned')}</p>
                <p className="text-2xl font-bold">{summary?.total_coins_earned ?? 0} ✨</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-text-secondary">
                  {t('creatorHub.tiersHeading', { active: String(activeTierCount), max: String(MAX_TIERS) })}
                </h2>
                {activeTierCount < MAX_TIERS && !creating && (
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="flex items-center gap-1 rounded-full bg-vault px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    {t('creatorHub.newTier')}
                  </button>
                )}
              </div>

              {creating && (
                <div className="mb-3 rounded-2xl border border-surface bg-surface/40 p-4 space-y-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('creatorHub.tierNamePlaceholder')}
                    className="w-full rounded-xl border border-surface bg-background px-3 py-2 text-sm"
                  />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('creatorHub.tierDescPlaceholder')}
                    rows={2}
                    className="w-full rounded-xl border border-surface bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-secondary">$</span>
                    <input
                      value={priceUsd}
                      onChange={(e) => setPriceUsd(e.target.value)}
                      type="number"
                      min="1"
                      step="0.01"
                      className="w-28 rounded-xl border border-surface bg-background px-3 py-2 text-sm"
                    />
                    <span className="text-sm text-text-secondary">{t('creatorHub.perMonth')}</span>
                  </div>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCreating(false)}
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-text-secondary"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={createBusy || !name.trim()}
                      onClick={() => void handleCreate()}
                      className="rounded-xl bg-vault px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {createBusy ? t('creatorHub.creating') : t('creatorHub.createTier')}
                    </button>
                  </div>
                </div>
              )}

              {tiers.length === 0 && !creating ? (
                <p className="text-sm text-text-secondary py-6 text-center">
                  {t('creatorHub.noTiers')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {tiers.map((tier) => (
                    <li
                      key={tier.id}
                      className="flex items-center justify-between rounded-2xl border border-surface bg-surface/30 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate">
                          {tier.name}
                          {!tier.is_active && (
                            <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                              {t('creatorHub.inactive')}
                            </span>
                          )}
                        </p>
                        {tier.description && (
                          <p className="text-xs text-text-secondary truncate">{tier.description}</p>
                        )}
                        <p className="text-xs text-text-secondary">${tier.price_usd.toFixed(2)}{t('creatorHub.perMonthShort')}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(tier)}
                          className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary"
                        >
                          {tier.is_active ? t('creatorHub.deactivate') : t('creatorHub.activate')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(tier)}
                          className="rounded-lg bg-red-600/10 p-1.5 text-red-600"
                          aria-label={t('creatorHub.deleteTierLabel')}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {summary && summary.subscribers.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-text-secondary">{t('creatorHub.yourSubscribers')}</h2>
                <ul className="space-y-2">
                  {summary.subscribers.map((s) => (
                    <li key={s.id} className="flex items-center justify-between rounded-xl border border-surface bg-surface/20 px-3 py-2 text-sm">
                      <span>{s.fan_username}</span>
                      <span className="text-xs text-text-secondary">{s.tier_name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-secondary flex items-center gap-1">
                  <PlayCircleIcon className="h-4 w-4" />
                  {t('creatorHub.vodLibrary')}
                </h2>
                <Link href="/live" className="text-xs font-semibold text-vault hover:underline">
                  {t('creatorHub.goLive')}
                </Link>
              </div>
              {vods.length === 0 ? (
                <p className="text-sm text-text-secondary rounded-2xl border border-surface bg-surface/20 p-4">
                  {t('creatorHub.noVods')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {vods.map((v) => (
                    <li key={v.id} className="rounded-xl border border-surface bg-surface/20 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{v.title || t('creatorHub.liveFallbackTitle', { id: String(v.id) })}</p>
                          <p className="text-xs text-text-secondary">
                            {v.ended_at ? new Date(v.ended_at).toLocaleString() : t('creatorHub.recording')}
                            {v.peak_viewers != null ? t('creatorHub.peakViewers', { count: String(v.peak_viewers) }) : ''}
                          </p>
                        </div>
                        {v.recording_url ? (
                          <button
                            type="button"
                            onClick={() => setExpandedVodId((cur) => (cur === v.id ? null : v.id))}
                            className="shrink-0 rounded-full bg-vault px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            {expandedVodId === v.id ? t('creatorHub.hide') : t('creatorHub.play')}
                          </button>
                        ) : null}
                      </div>
                      {v.recording_url && expandedVodId === v.id ? (
                        <CosmicVideoPlayer
                          src={mediaUrl(v.recording_url)}
                          className="mt-3 aspect-video"
                          style={{ maxHeight: 420 }}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
