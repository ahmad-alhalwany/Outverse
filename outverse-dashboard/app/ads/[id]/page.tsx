'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { useLocale } from '@/components/LocaleProvider';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import {
  fetchCampaign,
  pauseCampaign,
  resumeCampaign,
  fetchCampaignStats,
  fetchCreatives,
  createCreative,
  fetchAds,
  createAd,
  pauseAd,
  resumeAd,
  type AdCampaign,
  type AdCreative,
  type Ad,
  type CreativePayload,
} from '@/lib/adsApi';

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
    <span className="rounded-full px-2.5 py-1 text-xs font-semibold shrink-0" style={{ background: `${color}22`, color }}>
      {t(STATUS_KEYS[status] ?? 'ads.statusDraft')}
    </span>
  );
}

const FORMATS = [
  { id: 'image', labelKey: 'ads.formatImage' },
  { id: 'carousel', labelKey: 'ads.formatCarousel' },
  { id: 'video', labelKey: 'ads.formatVideo' },
  { id: 'story', labelKey: 'ads.formatStory' },
  { id: 'reel', labelKey: 'ads.formatReel' },
] as const;

const ASPECT_RATIOS = ['1:1', '9:16', '4:5', '16:9'];

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border p-6" style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)' }}>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium" style={{ color: 'rgb(var(--c-text))' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  background: 'rgb(var(--c-surface))',
  color: 'rgb(var(--c-text))',
  border: '1px solid var(--c-border)',
} as const;

export default function AdCampaignDetailPage() {
  const { t } = useLocale();
  const user = useAuthUser();
  const params = useParams();
  const campaignId = Number(params?.id);

  const [campaign, setCampaign] = useState<AdCampaign | null>(null);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [creatives, setCreatives] = useState<AdCreative[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [showCreativeForm, setShowCreativeForm] = useState(false);
  const [creativeSaving, setCreativeSaving] = useState(false);
  const [creativeError, setCreativeError] = useState('');
  const [creativeForm, setCreativeForm] = useState<Omit<CreativePayload, 'campaign'>>({
    name: '',
    format: 'image',
    media_urls: [],
    aspect_ratio: '1:1',
    headline: '',
    primary_text: '',
    cta_text: 'Learn More',
    landing_url: '',
  });
  const [mediaUrlsInput, setMediaUrlsInput] = useState('');

  const [showAdForm, setShowAdForm] = useState(false);
  const [adSaving, setAdSaving] = useState(false);
  const [adError, setAdError] = useState('');
  const [selectedCreativeId, setSelectedCreativeId] = useState<number | ''>('');

  async function load() {
    if (!campaignId) return;
    setLoading(true);
    const c = await fetchCampaign(campaignId);
    if (!c) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const [s, cr, ad] = await Promise.all([
      fetchCampaignStats(campaignId),
      fetchCreatives(campaignId),
      fetchAds(campaignId),
    ]);
    setCampaign(c);
    setStats(s);
    setCreatives(cr);
    setAds(ad);
    setLoading(false);
  }

  useEffect(() => {
    if (user && campaignId) void load();
    else if (!user) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, campaignId]);

  async function handlePause() {
    if (!campaign) return;
    await pauseCampaign(campaign.id);
    void load();
  }

  async function handleResume() {
    if (!campaign) return;
    await resumeCampaign(campaign.id);
    void load();
  }

  async function handleCreateCreative() {
    if (!campaign) return;
    if (!creativeForm.name.trim() || !creativeForm.landing_url.trim()) {
      setCreativeError(t('ads.createError'));
      return;
    }
    setCreativeSaving(true);
    setCreativeError('');
    const media_urls = mediaUrlsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await createCreative({
      ...creativeForm,
      campaign: campaign.id,
      media_urls,
    });
    setCreativeSaving(false);
    if (!res.ok) {
      setCreativeError(t('ads.createError'));
      return;
    }
    setShowCreativeForm(false);
    setCreativeForm({
      name: '', format: 'image', media_urls: [], aspect_ratio: '1:1',
      headline: '', primary_text: '', cta_text: 'Learn More', landing_url: '',
    });
    setMediaUrlsInput('');
    void load();
  }

  async function handleCreateAd() {
    if (!campaign || !selectedCreativeId) {
      setAdError(t('ads.noApprovedCreatives'));
      return;
    }
    setAdSaving(true);
    setAdError('');
    const res = await createAd({
      campaign: campaign.id,
      creative_id: selectedCreativeId,
    });
    setAdSaving(false);
    if (!res) {
      setAdError(t('ads.createError'));
      return;
    }
    setShowAdForm(false);
    setSelectedCreativeId('');
    void load();
  }

  async function handlePauseAd(id: number) {
    await pauseAd(id);
    void load();
  }

  async function handleResumeAd(id: number) {
    await resumeAd(id);
    void load();
  }

  if (!user) {
    return (
      <AppShell contentClassName="flex-1 min-w-0 w-full max-w-3xl mx-auto px-4 pb-12">
        <div className="mt-10 rounded-[28px] border p-10 text-center text-sm" style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)', color: 'rgb(var(--c-text-secondary))' }}>
          {t('ads.signInPrompt')}
        </div>
      </AppShell>
    );
  }

  if (notFound) {
    return (
      <AppShell contentClassName="flex-1 min-w-0 w-full max-w-3xl mx-auto px-4 pb-12">
        <div className="mt-10 rounded-[28px] border p-10 text-center text-sm" style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)', color: 'rgb(var(--c-text-secondary))' }}>
          {t('ads.notFound')}
        </div>
        <Link href="/ads" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--c-focus)' }}>
          <ArrowLeftIcon className="h-4 w-4" />
          {t('ads.back')}
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-3xl mx-auto px-4 pb-12">
      <section className="mb-4 mt-4">
        <Link href="/ads" className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--c-focus)' }}>
          <ArrowLeftIcon className="h-4 w-4" />
          {t('ads.back')}
        </Link>
      </section>

      {loading || !campaign ? (
        <p className="text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>{t('common.loading')}</p>
      ) : (
        <>
          <section className="mb-6 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'rgb(var(--c-text))' }}>
                {campaign.name}
              </h1>
              <StatusBadge status={campaign.status} t={t} />
            </div>
            {campaign.status === 'paused' || campaign.status === 'draft' ? (
              <button
                type="button"
                onClick={() => void handleResume()}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ background: 'var(--c-focus)' }}
              >
                {t('ads.resume')}
              </button>
            ) : campaign.status === 'active' ? (
              <button
                type="button"
                onClick={() => void handlePause()}
                className="rounded-xl px-4 py-2 text-sm font-semibold"
                style={{ background: 'rgb(var(--c-surface))', color: 'var(--c-icon)', border: '1px solid var(--c-border)' }}
              >
                {t('ads.pause')}
              </button>
            ) : null}
          </section>

          {stats && (
            <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: t('ads.impressions'), value: Number(stats.total_impressions ?? 0).toLocaleString() },
                { label: t('ads.clicks'), value: Number(stats.total_clicks ?? 0).toLocaleString() },
                { label: t('ads.spend'), value: `$${Number(stats.total_spend ?? 0).toFixed(2)}` },
                { label: t('ads.ctr'), value: `${stats.ctr ?? 0}%` },
                { label: t('ads.cpc'), value: `$${stats.cpc ?? 0}` },
                { label: t('ads.cpm'), value: `$${stats.cpm ?? 0}` },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border p-4" style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)' }}>
                  <p className="text-xs" style={{ color: 'rgb(var(--c-text-secondary))' }}>{s.label}</p>
                  <p className="mt-1 text-lg font-bold" style={{ color: 'rgb(var(--c-text))' }}>{s.value}</p>
                </div>
              ))}
            </section>
          )}

          {/* Creatives */}
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[1.05rem] font-semibold" style={{ color: 'rgb(var(--c-text))' }}>{t('ads.creatives')}</h2>
              <button
                type="button"
                onClick={() => setShowCreativeForm((v) => !v)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: 'var(--c-focus)' }}
              >
                <PlusIcon className="h-3.5 w-3.5" />
                {t('ads.addCreative')}
              </button>
            </div>

            {showCreativeForm && (
              <Card>
                <div className="space-y-4">
                  <Field label={t('ads.creativeName')}>
                    <input
                      type="text"
                      value={creativeForm.name}
                      onChange={(e) => setCreativeForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2 text-sm"
                      style={inputStyle}
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={t('ads.format')}>
                      <select
                        value={creativeForm.format}
                        onChange={(e) => setCreativeForm((f) => ({ ...f, format: e.target.value as CreativePayload['format'] }))}
                        className="w-full rounded-xl px-3 py-2 text-sm"
                        style={inputStyle}
                      >
                        {FORMATS.map((f) => <option key={f.id} value={f.id}>{t(f.labelKey)}</option>)}
                      </select>
                    </Field>
                    <Field label={t('ads.aspectRatio')}>
                      <select
                        value={creativeForm.aspect_ratio}
                        onChange={(e) => setCreativeForm((f) => ({ ...f, aspect_ratio: e.target.value }))}
                        className="w-full rounded-xl px-3 py-2 text-sm"
                        style={inputStyle}
                      >
                        {ASPECT_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label={t('ads.headline')}>
                    <input
                      type="text"
                      value={creativeForm.headline}
                      onChange={(e) => setCreativeForm((f) => ({ ...f, headline: e.target.value }))}
                      maxLength={125}
                      className="w-full rounded-xl px-3 py-2 text-sm"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label={t('ads.primaryText')}>
                    <textarea
                      value={creativeForm.primary_text}
                      onChange={(e) => setCreativeForm((f) => ({ ...f, primary_text: e.target.value }))}
                      maxLength={2000}
                      rows={3}
                      className="w-full rounded-xl px-3 py-2 text-sm"
                      style={inputStyle}
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={t('ads.ctaText')}>
                      <input
                        type="text"
                        value={creativeForm.cta_text}
                        onChange={(e) => setCreativeForm((f) => ({ ...f, cta_text: e.target.value }))}
                        maxLength={30}
                        className="w-full rounded-xl px-3 py-2 text-sm"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label={t('ads.landingUrl')}>
                      <input
                        type="url"
                        value={creativeForm.landing_url}
                        onChange={(e) => setCreativeForm((f) => ({ ...f, landing_url: e.target.value }))}
                        placeholder="https://…"
                        className="w-full rounded-xl px-3 py-2 text-sm"
                        style={inputStyle}
                      />
                    </Field>
                  </div>
                  <Field label={t('ads.mediaUrls')}>
                    <input
                      type="text"
                      value={mediaUrlsInput}
                      onChange={(e) => setMediaUrlsInput(e.target.value)}
                      placeholder="https://…, https://…"
                      className="w-full rounded-xl px-3 py-2 text-sm"
                      style={inputStyle}
                    />
                  </Field>

                  {creativeError && <p className="text-sm" style={{ color: '#ef4444' }}>{creativeError}</p>}

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={creativeSaving}
                      onClick={() => void handleCreateCreative()}
                      className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      style={{ background: 'var(--c-focus)' }}
                    >
                      {creativeSaving ? t('ads.creating') : t('ads.create')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCreativeForm(false); setCreativeError(''); }}
                      className="rounded-xl px-4 py-2.5 text-sm font-semibold"
                      style={{ color: 'var(--c-icon)' }}
                    >
                      {t('ads.cancel')}
                    </button>
                  </div>
                </div>
              </Card>
            )}

            <div className="mt-3 space-y-2">
              {creatives.length === 0 && !showCreativeForm ? (
                <p className="text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>{t('ads.noCreatives')}</p>
              ) : (
                creatives.map((cr) => (
                  <div key={cr.id} className="flex items-center justify-between gap-3 rounded-2xl border p-4" style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)' }}>
                    <div className="min-w-0">
                      <p className="truncate font-medium" style={{ color: 'rgb(var(--c-text))' }}>{cr.name}</p>
                      <p className="truncate text-xs" style={{ color: 'rgb(var(--c-text-secondary))' }}>
                        {cr.headline || cr.primary_text || cr.format}
                      </p>
                    </div>
                    <StatusBadge status={cr.status} t={t} />
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Ads */}
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[1.05rem] font-semibold" style={{ color: 'rgb(var(--c-text))' }}>{t('ads.adsSection')}</h2>
              <button
                type="button"
                onClick={() => setShowAdForm((v) => !v)}
                disabled={creatives.length === 0}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--c-focus)' }}
              >
                <PlusIcon className="h-3.5 w-3.5" />
                {t('ads.addAd')}
              </button>
            </div>

            {creatives.length === 0 && (
              <p className="mb-3 text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>{t('ads.noApprovedCreatives')}</p>
            )}

            {showAdForm && (
              <Card>
                <div className="space-y-4">
                  <Field label={t('ads.selectCreative')}>
                    <select
                      value={selectedCreativeId}
                      onChange={(e) => setSelectedCreativeId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full rounded-xl px-3 py-2 text-sm"
                      style={inputStyle}
                    >
                      <option value="">—</option>
                      {creatives.map((cr) => (
                        <option key={cr.id} value={cr.id}>{cr.name}</option>
                      ))}
                    </select>
                  </Field>

                  {adError && <p className="text-sm" style={{ color: '#ef4444' }}>{adError}</p>}

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={adSaving}
                      onClick={() => void handleCreateAd()}
                      className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      style={{ background: 'var(--c-focus)' }}
                    >
                      {adSaving ? t('ads.creating') : t('ads.create')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAdForm(false); setAdError(''); }}
                      className="rounded-xl px-4 py-2.5 text-sm font-semibold"
                      style={{ color: 'var(--c-icon)' }}
                    >
                      {t('ads.cancel')}
                    </button>
                  </div>
                </div>
              </Card>
            )}

            <div className="mt-3 space-y-2">
              {ads.length === 0 && !showAdForm ? (
                <p className="text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>{t('ads.noAds')}</p>
              ) : (
                ads.map((ad) => (
                  <div key={ad.id} className="rounded-2xl border p-4" style={{ background: 'rgb(var(--c-surface))', borderColor: 'var(--c-border)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-medium" style={{ color: 'rgb(var(--c-text))' }}>{ad.creative.name}</p>
                      <StatusBadge status={ad.status} t={t} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs" style={{ color: 'rgb(var(--c-text-secondary))' }}>
                      <span>{t('ads.impressions')}: {ad.impression_count.toLocaleString()}</span>
                      <span>{t('ads.clicks')}: {ad.click_count.toLocaleString()}</span>
                      <span>{t('ads.ctr')}: {ad.ctr}%</span>
                      <span>{t('ads.spend')}: ${Number(ad.spend).toFixed(2)}</span>
                    </div>
                    <div className="mt-3">
                      {ad.status === 'paused' || ad.status === 'draft' ? (
                        <button
                          type="button"
                          onClick={() => void handleResumeAd(ad.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                          style={{ background: 'var(--c-focus)' }}
                        >
                          {t('ads.resume')}
                        </button>
                      ) : ad.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => void handlePauseAd(ad.id)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                          style={{ background: 'rgb(var(--c-surface))', color: 'var(--c-icon)', border: '1px solid var(--c-border)' }}
                        >
                          {t('ads.pause')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
