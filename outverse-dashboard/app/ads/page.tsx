'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusIcon, MegaphoneIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { useLocale } from '@/components/LocaleProvider';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import {
  fetchCampaigns,
  createCampaign,
  pauseCampaign,
  resumeCampaign,
  activateCampaign,
  fetchAdReportSummary,
  type AdCampaign,
  type AdReportSummary,
  type CampaignPayload,
} from '@/lib/adsApi';

const OBJECTIVES = [
  { id: 'awareness', labelKey: 'ads.objAwareness' },
  { id: 'traffic', labelKey: 'ads.objTraffic' },
  { id: 'engagement', labelKey: 'ads.objEngagement' },
  { id: 'conversions', labelKey: 'ads.objConversions' },
  { id: 'app_installs', labelKey: 'ads.objAppInstalls' },
] as const;

const BID_STRATEGIES = [
  { id: 'cpm', labelKey: 'ads.bidCpm' },
  { id: 'cpc', labelKey: 'ads.bidCpc' },
  { id: 'cpa', labelKey: 'ads.bidCpa' },
] as const;

const PLACEMENTS = [
  { id: 'feed', labelKey: 'ads.placementFeed' },
  { id: 'stories', labelKey: 'ads.placementStories' },
  { id: 'reels', labelKey: 'ads.placementReels' },
  { id: 'explore', labelKey: 'ads.placementExplore' },
  { id: 'profile', labelKey: 'ads.placementProfile' },
] as const;

const STATUS_KEYS: Record<string, string> = {
  draft: 'ads.statusDraft',
  pending_review: 'ads.statusPendingReview',
  active: 'ads.statusActive',
  paused: 'ads.statusPaused',
  completed: 'ads.statusCompleted',
  rejected: 'ads.statusRejected',
  disapproved: 'ads.statusDisapproved',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  pending_review: '#f59e0b',
  active: '#22c55e',
  paused: '#f59e0b',
  completed: '#94a3b8',
  rejected: '#ef4444',
  disapproved: '#ef4444',
};

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const color = STATUS_COLORS[status] ?? '#94a3b8';
  return (
    <span
      className="rounded-full px-2.5 py-1 text-xs font-semibold shrink-0"
      style={{ background: `${color}22`, color }}
    >
      {t(STATUS_KEYS[status] ?? 'ads.statusDraft')}
    </span>
  );
}

function todayLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const DEFAULT_FORM: CampaignPayload = {
  name: '',
  objective: 'traffic',
  bid_strategy: 'cpm',
  daily_budget: '10.00',
  lifetime_budget: '100.00',
  start_date: todayLocalInput(),
  targeting: { placements: ['feed'] },
};

export default function AdsManagerPage() {
  const { t } = useLocale();
  const user = useAuthUser();
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [summary, setSummary] = useState<AdReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CampaignPayload>(DEFAULT_FORM);

  async function load() {
    setLoading(true);
    const [c, s] = await Promise.all([fetchCampaigns(), fetchAdReportSummary()]);
    setCampaigns(c);
    setSummary(s);
    setLoading(false);
  }

  useEffect(() => {
    if (user) void load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleCreate() {
    if (!form.name.trim()) {
      setError(t('ads.createError'));
      return;
    }
    setCreating(true);
    setError('');
    const res = await createCampaign({
      ...form,
      start_date: new Date(form.start_date).toISOString(),
    });
    setCreating(false);
    if (!res.ok) {
      setError(t('ads.createError'));
      return;
    }
    setShowForm(false);
    setForm(DEFAULT_FORM);
    void load();
  }

  async function handlePause(id: number) {
    await pauseCampaign(id);
    void load();
  }

  async function handleResume(id: number) {
    await resumeCampaign(id);
    void load();
  }

  async function handleActivate(id: number) {
    const res = await activateCampaign(id);
    if (!res.ok) {
      const detail =
        typeof (res.data as { detail?: string })?.detail === 'string'
          ? (res.data as { detail: string }).detail
          : t('ads.createError');
      setError(detail);
      return;
    }
    setError('');
    void load();
  }

  function togglePlacement(p: string) {
    setForm((f) => {
      const current = ((f.targeting?.placements as string[]) || []).slice();
      const next = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
      return { ...f, targeting: { ...f.targeting, placements: next } };
    });
  }

  const selectedPlacements = (form.targeting?.placements as string[]) || [];

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-3xl mx-auto px-4 pb-12">
      <section className="mb-6 mt-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'rgb(var(--c-text))' }}>
              {t('ads.title')}
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>
              {t('ads.subtitle')}
            </p>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white"
              style={{ background: 'var(--c-focus)' }}
            >
              <PlusIcon className="h-4 w-4" />
              {t('ads.newCampaign')}
            </button>
          )}
        </div>
      </section>

      {!user ? (
        <div
          className="rounded-[28px] border p-10 text-center text-sm"
          style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)', color: 'rgb(var(--c-text-secondary))' }}
        >
          {t('ads.signInPrompt')}
        </div>
      ) : (
        <>
          {summary && (
            <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t('ads.totalSpend'), value: `$${summary.total_spent.toFixed(2)}` },
                { label: t('ads.totalImpressions'), value: summary.total_impressions.toLocaleString() },
                { label: t('ads.totalClicks'), value: summary.total_clicks.toLocaleString() },
                { label: t('ads.overallCtr'), value: `${summary.overall_ctr}%` },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border p-4"
                  style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)' }}
                >
                  <p className="text-xs" style={{ color: 'rgb(var(--c-text-secondary))' }}>{stat.label}</p>
                  <p className="mt-1 text-xl font-bold" style={{ color: 'rgb(var(--c-text))' }}>{stat.value}</p>
                </div>
              ))}
            </section>
          )}

          {showForm && (
            <section
              className="mb-6 rounded-[28px] border p-6 space-y-4"
              style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)' }}
            >
              <h2 className="text-[1.05rem] font-semibold" style={{ color: 'rgb(var(--c-text))' }}>
                {t('ads.newCampaign')}
              </h2>

              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: 'rgb(var(--c-text))' }}>
                  {t('ads.campaignName')}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'rgb(var(--c-surface))', color: 'rgb(var(--c-text))', border: '1px solid var(--c-border)' }}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: 'rgb(var(--c-text))' }}>
                    {t('ads.objective')}
                  </label>
                  <select
                    value={form.objective}
                    onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={{ background: 'rgb(var(--c-surface))', color: 'rgb(var(--c-text))', border: '1px solid var(--c-border)' }}
                  >
                    {OBJECTIVES.map((o) => (
                      <option key={o.id} value={o.id}>{t(o.labelKey)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: 'rgb(var(--c-text))' }}>
                    {t('ads.bidStrategy')}
                  </label>
                  <select
                    value={form.bid_strategy}
                    onChange={(e) => setForm((f) => ({ ...f, bid_strategy: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={{ background: 'rgb(var(--c-surface))', color: 'rgb(var(--c-text))', border: '1px solid var(--c-border)' }}
                  >
                    {BID_STRATEGIES.map((b) => (
                      <option key={b.id} value={b.id}>{t(b.labelKey)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: 'rgb(var(--c-text))' }}>
                    {t('ads.dailyBudget')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.daily_budget}
                    onChange={(e) => setForm((f) => ({ ...f, daily_budget: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={{ background: 'rgb(var(--c-surface))', color: 'rgb(var(--c-text))', border: '1px solid var(--c-border)' }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: 'rgb(var(--c-text))' }}>
                    {t('ads.lifetimeBudget')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.lifetime_budget}
                    onChange={(e) => setForm((f) => ({ ...f, lifetime_budget: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={{ background: 'rgb(var(--c-surface))', color: 'rgb(var(--c-text))', border: '1px solid var(--c-border)' }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: 'rgb(var(--c-text))' }}>
                    {t('ads.startDate')}
                  </label>
                  <input
                    type="datetime-local"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={{ background: 'rgb(var(--c-surface))', color: 'rgb(var(--c-text))', border: '1px solid var(--c-border)' }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: 'rgb(var(--c-text))' }}>
                    {t('ads.endDate')}
                  </label>
                  <input
                    type="datetime-local"
                    value={form.end_date ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value || null }))}
                    className="w-full rounded-xl px-3 py-2 text-sm"
                    style={{ background: 'rgb(var(--c-surface))', color: 'rgb(var(--c-text))', border: '1px solid var(--c-border)' }}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'rgb(var(--c-text))' }}>
                  {t('ads.placements')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLACEMENTS.map((p) => {
                    const active = selectedPlacements.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlacement(p.id)}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
                        style={{
                          background: active ? 'var(--c-focus)' : 'rgb(var(--c-surface))',
                          color: active ? '#FFFFFF' : 'var(--c-icon)',
                          border: active ? 'none' : '1px solid var(--c-border)',
                        }}
                      >
                        {t(p.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void handleCreate()}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: 'var(--c-focus)' }}
                >
                  {creating ? t('ads.creating') : t('ads.create')}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(''); }}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold"
                  style={{ color: 'var(--c-icon)' }}
                >
                  {t('ads.cancel')}
                </button>
              </div>
            </section>
          )}

          <section className="space-y-3">
            {loading ? (
              <p className="text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>{t('common.loading')}</p>
            ) : campaigns.length === 0 ? (
              <div
                className="rounded-[28px] border p-10 text-center text-sm"
                style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)', color: 'rgb(var(--c-text-secondary))' }}
              >
                {t('ads.noCampaigns')}
              </div>
            ) : (
              campaigns.map((c) => {
                const spent = parseFloat(c.spent);
                const budget = parseFloat(c.lifetime_budget) || 1;
                const pct = Math.min(100, Math.round((spent / budget) * 100));
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border p-5"
                    style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <MegaphoneIcon className="h-5 w-5 shrink-0" style={{ color: 'var(--c-focus)' }} />
                        <Link href={`/ads/${c.id}`} className="truncate font-semibold hover:underline" style={{ color: 'rgb(var(--c-text))' }}>
                          {c.name}
                        </Link>
                      </div>
                      <StatusBadge status={c.status} t={t} />
                    </div>

                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs" style={{ color: 'rgb(var(--c-text-secondary))' }}>
                        <span>{t('ads.spent')}: ${spent.toFixed(2)}</span>
                        <span>{t('ads.budget')}: ${budget.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--c-track)' }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: 'var(--c-focus)' }} />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <Link
                        href={`/ads/${c.id}`}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                        style={{ background: 'rgb(var(--c-surface))', color: 'var(--c-icon)', border: '1px solid var(--c-border)' }}
                      >
                        {t('ads.viewDetails')}
                      </Link>
                      {c.status === 'draft' ? (
                        <button
                          type="button"
                          onClick={() => void handleActivate(c.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                          style={{ background: 'var(--c-focus)' }}
                        >
                          Activate
                        </button>
                      ) : c.status === 'paused' ? (
                        <button
                          type="button"
                          onClick={() => void handleResume(c.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                          style={{ background: 'var(--c-focus)' }}
                        >
                          {t('ads.resume')}
                        </button>
                      ) : c.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => void handlePause(c.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                          style={{ background: 'rgb(var(--c-surface))', color: 'var(--c-icon)', border: '1px solid var(--c-border)' }}
                        >
                          {t('ads.pause')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
