'use client';

import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  TrashIcon,
  PaperAirplaneIcon,
  Squares2X2Icon,
  Cog6ToothIcon,
  MapPinIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import EmotionVaultMap, { type VaultMapMarker } from '@/components/vault/EmotionVaultMap';
import Link from 'next/link';
import { readVaultMapStyle, type VaultMapStyle } from '@/lib/vaultMapStyle';
import { readSettingsPrefs } from '@/lib/settingsPrefs';
import RelativeTime from '../../components/RelativeTime';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';
import { polishVaultTone } from '@/lib/aiCoachApi';
import { searchLocation } from '@/lib/geocode';
import { formatBottleTimeLeft } from '@/utils/bottleTime';
import {
  DEMO_BOTTLES,
  DEMO_DASHBOARD,
  demoMarkers,
  demoPlaceLabels,
  moodSummaryRows,
  shouldUseVaultDemo,
} from '@/lib/vaultDemoData';
import { getUser } from '@/lib/auth';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { apiUrl } from '@/lib/api';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import './vault.css';

const BASE = apiUrl('bottles');

const PALETTES = {
  light: {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    headerBg: 'rgba(243,240,252,0.85)',
    overlay: 'rgba(33,27,61,0.45)',
    shadowSm: '0 2px 10px rgba(124,58,237,0.08)',
    btnShadow: '0 6px 20px rgba(124,58,237,0.3)',
    modalShadow: '0 20px 60px rgba(33,27,61,0.3)',
    progressBg: 'rgba(0,0,0,0.06)',
    fabShadow: '0 4px 16px rgba(124,58,237,0.5)',
  },
  dark: {
    cream: '#14102A',
    card: '#1E1740',
    card2: '#251B4D',
    white: '#2A2154',
    brown: '#C4B5FD',
    brownDk: '#A78BFA',
    text: '#F5F3FF',
    text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
    headerBg: 'rgba(20,16,42,0.9)',
    overlay: 'rgba(10,8,24,0.65)',
    shadowSm: '0 2px 10px rgba(167,139,250,0.14)',
    btnShadow: '0 6px 20px rgba(167,139,250,0.3)',
    modalShadow: '0 20px 60px rgba(0,0,0,0.45)',
    progressBg: 'rgba(255,255,255,0.08)',
    fabShadow: '0 4px 16px rgba(167,139,250,0.35)',
  },
};

function useVaultColors() {
  const { theme } = useTheme();
  return PALETTES[theme];
}

type Emotion = { key: string; label: string; emoji: string; color: string };

const EMOTIONS: Emotion[] = [
  { key: 'joy', label: 'Joy', emoji: '☀️', color: '#F2A93B' },
  { key: 'hope', label: 'Hope', emoji: '🌅', color: '#3FB6A0' },
  { key: 'calm', label: 'Calm', emoji: '🌊', color: '#4FA3D1' },
  { key: 'love', label: 'Love', emoji: '💗', color: '#E86A9C' },
  { key: 'sad', label: 'Sadness', emoji: '🌧️', color: '#6E7BD1' },
  { key: 'lonely', label: 'Loneliness', emoji: '🌙', color: '#9385D6' },
  { key: 'anxious', label: 'Anxiety', emoji: '🌪️', color: '#E08653' },
  { key: 'nostalgic', label: 'Nostalgia', emoji: '📻', color: '#C49A5A' },
  { key: 'mystery', label: 'Mystery', emoji: '✨', color: '#A86BB0' },
];

function emotionMeta(key: string | null | undefined): Emotion {
  return EMOTIONS.find((e) => e.key === key) || EMOTIONS[EMOTIONS.length - 1];
}

const POSITIVE_MOODS = new Set(['joy', 'hope', 'calm', 'love']);

type TimelineDay = { day: number; date: string; emotion: string | null };
type Insight = { emotion: string; pct: number };
type Dashboard = {
  thrown: number;
  caught: number;
  timeline: TimelineDay[];
  insights: Insight[];
  current_mood: string | null;
};
type ApiBottle = {
  id: number;
  emotion_type: string;
  message?: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
  caught_at?: string | null;
  expires_at?: string;
  is_mine?: boolean;
  sender_username?: string | null;
};
type CaughtBottle = {
  id: number;
  message: string;
  emotion_type: string;
  created_at: string;
  sender_anon_id: string;
};
type PlaceLabelMap = Record<number, string>;

function EmotionVaultContent() {
  const C = useVaultColors();
  const { theme } = useTheme();
  const confirm = useConfirm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [throwOpen, setThrowOpen] = useState(false);
  const [catchOpen, setCatchOpen] = useState(false);
  const [previewBottle, setPreviewBottle] = useState<ApiBottle | null>(null);
  const [previewMissing, setPreviewMissing] = useState(false);
  const [myActive, setMyActive] = useState<ApiBottle[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [markers, setMarkers] = useState<VaultMapMarker[]>([]);
  const [recent, setRecent] = useState<ApiBottle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [placeLabels, setPlaceLabels] = useState<PlaceLabelMap>({});
  const [mapStyle, setMapStyle] = useState<VaultMapStyle>('street');
  const [demoMode, setDemoMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'vault' | 'catches'>('vault');
  const [includeExpired, setIncludeExpired] = useState(false);
  const [caughtBottles, setCaughtBottles] = useState<ApiBottle[]>([]);
  const [emotionFilter, setEmotionFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loadError, setLoadError] = useState(false);
  const authUser = useAuthUser();

  useEffect(() => {
    setMapStyle(readVaultMapStyle());
  }, []);

  useEffect(() => {
    if (searchParams.get('compose') === '1' || searchParams.get('idea_id')) {
      setThrowOpen(true);
    }
  }, [searchParams]);

  const loadData = useCallback(async () => {
    const prefs = readSettingsPrefs();
    let gotMarkers: VaultMapMarker[] = [];
    let gotRecent: ApiBottle[] = [];
    let gotDashboard: Dashboard | null = null;
    const params = new URLSearchParams();
    if (emotionFilter !== 'all') params.set('emotion', emotionFilter);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    const filterQs = params.toString();
    try {
      const [dRes, mRes, rRes, mineRes, caughtRes] = await Promise.all([
        apiFetch('bottles/dashboard/'),
        apiFetch('bottles/map/'),
        apiFetch('bottles/recent/'),
        apiFetch(`bottles/my_bottles/?${includeExpired ? 'active=0' : 'active=1'}${filterQs ? `&${filterQs}` : ''}`),
        apiFetch(`bottles/caught/${filterQs ? `?${filterQs}` : ''}`),
      ]);
      if (dRes.ok) {
        gotDashboard = await dRes.json();
        setDashboard(gotDashboard);
      }
      if (mRes.ok) {
        const data: ApiBottle[] = await mRes.json();
        gotMarkers = data
          .filter((b) => b.location_lat != null && b.location_lng != null)
          .map((b) => {
            const em = emotionMeta(b.emotion_type);
            return {
              id: b.id,
              lat: b.location_lat as number,
              lng: b.location_lng as number,
              color: em.color,
              emoji: em.emoji,
              label: em.label,
              expiresAt: b.expires_at,
              isMine: b.is_mine,
              message: b.message,
              senderName: b.sender_username,
            };
          });
        setMarkers(gotMarkers);
      }
      if (rRes.ok) {
        gotRecent = await rRes.json();
        setRecent(gotRecent);
      }
      if (mineRes.ok) {
        const mine = await mineRes.json();
        setMyActive(Array.isArray(mine) ? mine : []);
      }
      if (caughtRes.ok) {
        const caught = await caughtRes.json();
        setCaughtBottles(Array.isArray(caught) ? caught : []);
      }

      const apiEmpty = gotMarkers.length === 0 && gotRecent.length === 0;
      const explicitDemo = process.env.NEXT_PUBLIC_ENABLE_VAULT_DEMO === 'true';
      if (explicitDemo && shouldUseVaultDemo(apiEmpty)) {
        setDemoMode(true);
        setDashboard(DEMO_DASHBOARD);
        setMarkers(demoMarkers(prefs.showOwnMessageOnMap));
        setRecent(DEMO_BOTTLES as ApiBottle[]);
        setPlaceLabels(demoPlaceLabels());
      } else {
        setDemoMode(false);
      }
      setLoadError(false);
    } catch {
      const explicitDemo = process.env.NEXT_PUBLIC_ENABLE_VAULT_DEMO === 'true';
      if (explicitDemo) {
        setDemoMode(true);
        setDashboard(DEMO_DASHBOARD);
        setMarkers(demoMarkers(prefs.showOwnMessageOnMap));
        setRecent(DEMO_BOTTLES as ApiBottle[]);
        setPlaceLabels(demoPlaceLabels());
      } else {
        setDemoMode(false);
        setLoadError(true);
      }
    }
  }, [emotionFilter, startDate, endDate, includeExpired]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60_000);
    const onFocus = () => loadData();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadData]);

  const openBottlePreview = useCallback(
    (b: ApiBottle, opts?: { updateUrl?: boolean }) => {
      setPreviewMissing(false);
      setPreviewBottle(b);
      if (b.location_lat != null && b.location_lng != null) {
        setFlyTarget({ lat: b.location_lat, lng: b.location_lng, zoom: 12 });
      }
      if (opts?.updateUrl !== false) {
        router.replace(`/bottles?bottle=${b.id}`);
      }
    },
    [router],
  );

  const closeBottlePreview = useCallback(() => {
    setPreviewBottle(null);
    setPreviewMissing(false);
    if (searchParams.get('bottle')) router.replace('/bottles');
  }, [router, searchParams]);

  useEffect(() => {
    const id = searchParams.get('bottle');
    if (!id) return;
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) return;
    if (previewBottle?.id === num) return;

    const hit = recent.find((b) => b.id === num) || myActive.find((b) => b.id === num);
    if (hit) {
      openBottlePreview(hit, { updateUrl: false });
      return;
    }

    const fromMarker = markers.find((m) => m.id === num);
    if (fromMarker) {
      openBottlePreview(
        {
          id: num,
          emotion_type: 'mystery',
          location_lat: fromMarker.lat,
          location_lng: fromMarker.lng,
          created_at: new Date().toISOString(),
          expires_at: fromMarker.expiresAt,
          is_mine: fromMarker.isMine,
          message: fromMarker.message ?? undefined,
        },
        { updateUrl: false },
      );
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`bottles/${num}/`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data?.id) openBottlePreview(data, { updateUrl: false });
          else setPreviewMissing(true);
        } else {
          setPreviewMissing(true);
        }
      } catch {
        if (!cancelled) setPreviewMissing(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, recent, myActive, markers, previewBottle?.id, openBottlePreview]);

  useEffect(() => {
    if (!searchParams.get('bottle')) {
      setPreviewBottle(null);
      setPreviewMissing(false);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { reverseGeocodeLabel } = await import('@/lib/geocode');
      const next: PlaceLabelMap = {};
      for (const b of recent) {
        if (b.location_lat == null || b.location_lng == null) continue;
        const label = await reverseGeocodeLabel(b.location_lat, b.location_lng);
        if (label) next[b.id] = label;
        if (cancelled) return;
      }
      if (!cancelled) setPlaceLabels((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [recent]);

  async function handleSearchSubmit() {
    const target = await searchLocation(searchQuery);
    if (target) setFlyTarget(target);
  }

  const timeline: TimelineDay[] =
    dashboard?.timeline ??
    Array.from({ length: 30 }, (_, i) => ({ day: i + 1, date: '', emotion: null }));
  const insights = dashboard?.insights ?? [];
  const thrown = dashboard?.thrown ?? 0;
  const caught = dashboard?.caught ?? 0;
  const currentMood = dashboard?.current_mood ? emotionMeta(dashboard.current_mood) : null;
  const happyDays = timeline.filter((t) => t.emotion && POSITIVE_MOODS.has(t.emotion)).length;
  const happyPct = timeline.length ? Math.round((happyDays / 30) * 100) : 0;
  const vaultColors = {
    brown: '#1a1a1a',
    brownDk: '#1a1a1a',
    white: C.white,
    text: C.text,
    text2: C.text2,
    line: C.line,
    btnShadow: C.btnShadow,
  };

  const displayRecent = demoMode ? recent : recent;
  const previewMessage = (b: ApiBottle) => b.message || null;

  const deleteBottle = async (id: number) => {
    if (!(await confirm('Delete this bottle permanently?', { danger: true, confirmLabel: 'Delete' }))) return;
    try {
      const res = await apiFetch(`bottles/${id}/`, { method: 'DELETE' });
      if (!res.ok) return;
      if (previewBottle?.id === id) {
        closeBottlePreview();
      }
      await loadData();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="vault-page">
      <div className="vault-page__inner">
        <header className="vault-header">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="vault-header__title">Emotion Vault</h1>
            {demoMode && <span className="vault-demo-badge">Demo data</span>}
          </div>
          <div className="vault-header__search">
            <div className="vault-header__search-wrap">
              <MapPinIcon className="vault-header__search-icon" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                placeholder="Search location…"
              />
            </div>
          </div>
          <div className="vault-header__actions">
            <Link href="/settings" className="vault-icon-btn" aria-label="Settings">
              <Cog6ToothIcon className="h-5 w-5" />
            </Link>
            <Link href={authUser?.id ? `/profile/${authUser.id}` : '/login'} className="vault-avatar">
              {(authUser?.username || '?').slice(0, 2).toUpperCase()}
            </Link>
          </div>
        </header>

        {loadError && (
          <div className="vault-error-banner">
            <span>Could not load the vault. Showing your last known data.</span>
            <button type="button" onClick={() => void loadData()}>Retry</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT */}
          <div className="lg:col-span-3 order-2 lg:order-1 space-y-4" id="timeline">
            <div className="rounded-3xl p-4" style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-bold" style={{ color: C.text }}>Vault Filters</h2>
                <div className="flex rounded-full p-1" style={{ background: C.card2 }}>
                  <button type="button" onClick={() => setActiveTab('vault')} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: activeTab === 'vault' ? C.white : 'transparent', color: activeTab === 'vault' ? C.brown : C.text2 }}>My Vault</button>
                  <button type="button" onClick={() => setActiveTab('catches')} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: activeTab === 'catches' ? C.white : 'transparent', color: activeTab === 'catches' ? C.brown : C.text2 }}>My Catches</button>
                </div>
              </div>
              {activeTab === 'vault' && (
                <label className="flex items-center gap-2 text-xs mb-2" style={{ color: C.text2 }}>
                  <input type="checkbox" checked={includeExpired} onChange={(e) => setIncludeExpired(e.target.checked)} />
                  Include expired bottles
                </label>
              )}
              <div className="space-y-3">
                <select value={emotionFilter} onChange={(e) => setEmotionFilter(e.target.value)} className="w-full rounded-2xl px-3 py-2 text-sm outline-none" style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text }}>
                  <option value="all">All emotions</option>
                  {EMOTIONS.map((emotion) => (
                    <option key={emotion.key} value={emotion.key}>{emotion.label}</option>
                  ))}
                </select>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-2xl px-3 py-2 text-sm outline-none" style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text }} />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-2xl px-3 py-2 text-sm outline-none" style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text }} />
              </div>
            </div>
            <MoodTimeline timeline={timeline} />
            <MonthlySummary insights={insights} happyPct={happyPct} />
          </div>

          {/* CENTER */}
          <div className="lg:col-span-6 order-1 lg:order-2" id="map">
            <EmotionVaultMap
              markers={markers}
              variant={theme === 'dark' ? 'dark' : 'light'}
              colors={vaultColors}
              height={520}
              onThrow={() => setThrowOpen(true)}
              onCatch={() => setCatchOpen(true)}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              flyTarget={flyTarget}
              onFlyTargetChange={setFlyTarget}
              mapStyle={mapStyle}
              onMapStyleChange={setMapStyle}
            />

            {markers.length > 0 && (
              <p className="text-xs mt-2 text-center" style={{ color: C.text2 }}>
                🍶 {markers.length} drifting {markers.length === 1 ? 'bottle' : 'bottles'} on the map · each vanishes after 24 hours
              </p>
            )}

            <div className="vault-stats-bar">
              <span className="flex items-center gap-2 flex-wrap">
                Current Mood:
                {currentMood ? (
                  <span
                    className="vault-mood-pill"
                    style={{ background: `${currentMood.color}20`, color: currentMood.color }}
                  >
                    {currentMood.emoji} {currentMood.label}
                  </span>
                ) : (
                  <span>—</span>
                )}
              </span>
              <span>
                <strong style={{ color: 'var(--vault-text)' }}>{thrown}</strong> bottles thrown ·{' '}
                <strong style={{ color: 'var(--vault-text)' }}>{caught}</strong> bottles caught
              </span>
            </div>

            <div className="mt-5 rounded-3xl p-4" style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold" style={{ color: C.text }}>{activeTab === 'vault' ? 'My Bottles' : 'My Catches'}</h2>
                <span className="text-xs" style={{ color: C.text2 }}>{activeTab === 'vault' ? myActive.length : caughtBottles.length} entries</span>
              </div>
              <div className="space-y-3">
                {(activeTab === 'vault' ? myActive : caughtBottles).length === 0 ? (
                  <p className="text-sm" style={{ color: C.text2 }}>
                    {activeTab === 'vault' ? 'No bottles match these filters.' : 'No catches match these filters.'}
                  </p>
                ) : (
                  (activeTab === 'vault' ? myActive : caughtBottles).map((bottle) => {
                    const emotion = emotionMeta(bottle.emotion_type);
                    return (
                      <div key={bottle.id} className="rounded-2xl p-4" style={{ background: C.card2, border: `1px solid ${C.line}` }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold" style={{ background: `${emotion.color}22`, color: emotion.color }}>
                              {emotion.emoji} {emotion.label}
                            </span>
                            <p className="mt-2 text-sm leading-relaxed" style={{ color: C.text }}>{bottle.message || 'Caught bottle'}</p>
                            <p className="mt-2 text-xs" style={{ color: C.text2 }}>
                              <RelativeTime date={activeTab === 'catches' && bottle.caught_at ? bottle.caught_at : bottle.created_at} />
                            </p>
                          </div>
                          {activeTab === 'vault' && (
                            <button type="button" onClick={() => deleteBottle(bottle.id)} className="rounded-full p-2" style={{ background: C.white, color: C.brown, border: `1px solid ${C.line}` }} aria-label="Delete bottle">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-3 order-3 space-y-3" id="bottles">
            <div className="hidden lg:flex flex-col gap-2">
              <button type="button" onClick={() => setThrowOpen(true)} className="vault-btn-primary">
                <PaperAirplaneIcon className="h-5 w-5" />
                Throw a Bottle
              </button>
              <button type="button" onClick={() => setCatchOpen(true)} className="vault-btn-secondary">
                <Squares2X2Icon className="h-5 w-5" />
                Catch a Bottle
              </button>
            </div>

            {myActive.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: C.text }}>
                  Your active bottles ({myActive.length})
                </h3>
                <div className="space-y-2">
                  {myActive.map((b) => {
                    const m = emotionMeta(b.emotion_type);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => openBottlePreview(b)}
                        className="w-full rounded-xl p-3 text-left transition hover:opacity-90"
                        style={{ background: C.card2, border: `1px solid ${C.line}` }}
                      >
                        <span className="text-xs font-medium" style={{ color: m.color }}>
                          {m.emoji} {m.label}
                        </span>
                        {b.message && (
                          <p className="text-sm mt-1 line-clamp-2" style={{ color: C.text }}>
                            {b.message}
                          </p>
                        )}
                        {b.expires_at && (
                          <p className="text-[11px] mt-1" style={{ color: C.text2 }}>
                            ⏳ {formatBottleTimeLeft(b.expires_at)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <h3 className="text-sm font-semibold pt-1" style={{ color: 'var(--vault-text)' }}>
              Recent Bottles
            </h3>
            {displayRecent.length === 0 && (
              <div className="vault-card text-sm" style={{ color: 'var(--vault-muted)' }}>
                No drifting bottles right now — throw one with a location to appear on the map.
              </div>
            )}
            {displayRecent.map((b) => {
              const m = emotionMeta(b.emotion_type);
              const place =
                placeLabels[b.id] ??
                (b as ApiBottle & { place?: string }).place ??
                (b.location_lat != null ? 'On map' : null);
              const msg = previewMessage(b);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => openBottlePreview(b)}
                  className="vault-recent-card"
                >
                  {place && (
                    <div className="vault-recent-card__place">
                      <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
                      {place}
                    </div>
                  )}
                  {msg && <p className="vault-recent-card__msg">{msg}</p>}
                  <div className="flex items-center justify-between">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: `${m.color}18`, color: m.color }}
                    >
                      {m.emoji} {m.label}
                    </span>
                    <span className="flex items-center gap-2">
                      {b.sender_username && (
                        <span className="text-xs" style={{ color: 'var(--vault-muted)' }}>@{b.sender_username}</span>
                      )}
                      <RelativeTime date={b.created_at} className="text-xs" style={{ color: 'var(--vault-muted)' }} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      <AnimatePresence>
        {throwOpen && (
          <ThrowBottleModal ideaId={searchParams.get('idea_id')} onClose={() => setThrowOpen(false)} onThrown={loadData} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {catchOpen && (
          <CatchBottleModal onClose={() => setCatchOpen(false)} onCaught={loadData} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {(previewBottle || previewMissing) && (
          <BottlePreviewModal
            bottle={previewBottle}
            missing={previewMissing}
            placeLabel={previewBottle ? placeLabels[previewBottle.id] : undefined}
            linkCopied={linkCopied}
            onCopyLink={async () => {
              if (!previewBottle || typeof window === 'undefined') return;
              const url = `${window.location.origin}/bottles?bottle=${previewBottle.id}`;
              try {
                await navigator.clipboard.writeText(url);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              } catch {
                /* ignore */
              }
            }}
            onClose={closeBottlePreview}
            onCatch={() => {
              closeBottlePreview();
              setCatchOpen(true);
            }}
          />
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

export default function EmotionVaultPage() {
  return (
    <Suspense
      fallback={
        <div className="vault-page min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <EmotionVaultContent />
    </Suspense>
  );
}

// ----------------------------- Sub-components -----------------------------

function MoodTimeline({ timeline }: { timeline: TimelineDay[] }) {
  return (
    <div className="vault-card">
      <h3 className="vault-card__title">Your Mood Timeline</h3>
      <div className="vault-timeline-grid">
        {timeline.map((t) => {
          const has = !!t.emotion;
          const m = emotionMeta(t.emotion);
          return (
            <div
              key={t.day}
              title={has ? `Day ${t.day} · ${m.label}` : `Day ${t.day}`}
              className={`vault-timeline-cell${t.day === 1 ? ' vault-timeline-cell--active' : ''}`}
              style={
                has
                  ? { background: `${m.color}14`, borderColor: `${m.color}35` }
                  : undefined
              }
            >
              <span>{t.day}</span>
              <span className="vault-timeline-cell__emoji">{has ? m.emoji : '·'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthlySummary({ insights, happyPct }: { insights: Insight[]; happyPct: number }) {
  const rows =
    insights.length > 0
      ? moodSummaryRows(insights)
      : moodSummaryRows(DEMO_DASHBOARD.insights);

  return (
    <div className="vault-card">
      <h3 className="vault-card__title">Monthly Summary</h3>
      {rows.map((row) => (
        <div key={row.key}>
          <div className="vault-summary-row">
            <span>
              {row.emoji} {row.label}
            </span>
            <span style={{ color: row.color, fontWeight: 600 }}>{row.pct}%</span>
          </div>
          <div className="vault-summary-bar">
            <div className="vault-summary-bar__fill" style={{ width: `${row.pct}%`, background: row.color }} />
          </div>
        </div>
      ))}
      {happyPct > 0 && (
        <p className="text-xs mt-2" style={{ color: 'var(--vault-muted)' }}>
          Positive mood days: <strong>{happyPct}%</strong>
        </p>
      )}
    </div>
  );
}

function ModalShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const C = useVaultColors();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: C.overlay, backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto"
        style={{ background: C.cream, boxShadow: C.modalShadow, border: `1px solid ${C.line}` }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full text-xl flex items-center justify-center"
          style={{ background: C.card, color: C.text }}
          aria-label="Close"
        >
          ×
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}

function getLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 6000 },
    );
  });
}

function ThrowBottleModal({ onClose, onThrown, ideaId }: { onClose: () => void; onThrown: () => void; ideaId?: string | null }) {
  const C = useVaultColors();
  const [message, setMessage] = useState(ideaId ? `A spark from Bazaar idea #${ideaId}…` : '');
  const [emotion, setEmotion] = useState('mystery');
  const [shareLocation, setShareLocation] = useState(true);
  const [throwing, setThrowing] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [polishNote, setPolishNote] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handlePolish() {
    if (!message.trim()) return;
    setPolishing(true);
    setPolishNote('');
    const result = await polishVaultTone({ text: message.trim(), kind: 'bottle' });
    setPolishing(false);
    if (result.error) { setError(result.error); return; }
    setMessage(result.polished);
    setPolishNote(result.note);
  }

  async function handleThrow(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      setError('Write a message before sending it to the cosmos.');
      return;
    }
    setError('');
    setThrowing(true);
    try {
      const loc = shareLocation ? await getLocation() : null;
      const res = await apiFetchJson('bottles/throw/', {
        method: 'POST',
        json: {
          message: message.trim(),
          emotion_type: emotion,
          location_lat: loc?.lat ?? null,
          location_lng: loc?.lng ?? null,
        },
      });
      if (!res.ok) throw new Error('throw failed');
      setDone(true);
      onThrown();
      setTimeout(onClose, 1600);
    } catch {
      setError('The bottle slipped away. Check your connection and try again.');
    } finally {
      setThrowing(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      {done ? (
        <div className="text-center py-8">
          <motion.div initial={{ y: 40, opacity: 0, scale: 0.6 }} animate={{ y: -30, opacity: 1, scale: 1 }} transition={{ duration: 1.2, type: 'spring' }} className="text-6xl">
            🍶
          </motion.div>
          <p className="mt-4" style={{ color: C.text2 }}>Your bottle is drifting through the cosmos…</p>
        </div>
      ) : (
        <form onSubmit={handleThrow}>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: C.text }}>
            <span>🚀</span> Throw a bottle
          </h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {EMOTIONS.map((em) => (
              <button
                type="button"
                key={em.key}
                onClick={() => setEmotion(em.key)}
                className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                style={{
                  background: emotion === em.key ? em.color : C.white,
                  color: emotion === em.key ? '#fff' : C.text,
                  border: `1px solid ${emotion === em.key ? em.color : C.line}`,
                  boxShadow: emotion === em.key ? `0 4px 14px ${em.color}55` : 'none',
                }}
              >
                <span className="mr-1">{em.emoji}</span>
                {em.label}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Whisper your message to the cosmos…"
            maxLength={500}
            rows={4}
            className="w-full rounded-xl p-3 outline-none resize-none"
            style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          />
          <div className="flex items-center justify-between mt-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: C.text2 }}>
              <input type="checkbox" checked={shareLocation} onChange={(e) => setShareLocation(e.target.checked)} />
              📍 Share location — appears on the map for 24 hours
            </label>
            <span className="text-xs" style={{ color: C.text2 }}>{message.length}/500</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            {polishNote ? (
              <span className="text-xs" style={{ color: C.text2 }}>✨ {polishNote}</span>
            ) : <span />}
            <button
              type="button"
              onClick={() => void handlePolish()}
              disabled={polishing || !message.trim()}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}
            >
              {polishing ? '✨ Polishing…' : '✨ Polish tone'}
            </button>
          </div>
          {error && <div className="text-sm mt-2" style={{ color: '#c0392b' }}>{error}</div>}
          <button
            type="submit"
            disabled={throwing}
            className="mt-4 w-full rounded-xl py-3 font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`, boxShadow: C.btnShadow }}
          >
            {throwing ? 'Drifting away…' : 'Send to the cosmos'}
          </button>
        </form>
      )}
    </ModalShell>
  );
}

function BottlePreviewModal({
  bottle,
  missing,
  placeLabel,
  linkCopied,
  onCopyLink,
  onClose,
  onCatch,
}: {
  bottle: ApiBottle | null;
  missing: boolean;
  placeLabel?: string;
  linkCopied: boolean;
  onCopyLink: () => void;
  onClose: () => void;
  onCatch: () => void;
}) {
  const C = useVaultColors();
  const m = bottle ? emotionMeta(bottle.emotion_type) : null;

  return (
    <ModalShell onClose={onClose}>
      {missing || !bottle ? (
        <div className="text-center py-6">
          <p className="text-4xl mb-3">🌊</p>
          <p className="font-semibold" style={{ color: C.text }}>
            Bottle not found
          </p>
          <p className="text-sm mt-2" style={{ color: C.text2 }}>
            It may have expired or already been caught.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 pr-8">
            <span
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: `${m!.color}22`, color: m!.color }}
            >
              {m!.emoji} {m!.label}
            </span>
            {bottle.is_mine && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: C.card2, color: C.brown }}>
                Yours
              </span>
            )}
          </div>
          {placeLabel && (
            <p className="flex items-center gap-1.5 text-xs font-medium mt-3" style={{ color: C.brown }}>
              <MapPinIcon className="h-3.5 w-3.5" />
              {placeLabel}
            </p>
          )}
          {bottle.sender_username && (
            <p className="text-xs mt-2" style={{ color: C.text2 }}>from @{bottle.sender_username}</p>
          )}
          {bottle.message && (
            <p className="text-sm mt-4 leading-relaxed whitespace-pre-wrap" style={{ color: C.text }}>
              {bottle.message}
            </p>
          )}
          {bottle.expires_at && (
            <p className="text-xs mt-3" style={{ color: C.text2 }}>
              ⏳ Vanishes in {formatBottleTimeLeft(bottle.expires_at)}
            </p>
          )}
          <p className="text-xs mt-2" style={{ color: C.text2 }}>
            <RelativeTime date={bottle.created_at} className="text-xs block" style={{ color: C.text2 }} />
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <button
              type="button"
              onClick={onCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: C.white, color: C.text, border: `1px solid ${C.line}` }}
            >
              <LinkIcon className="h-4 w-4" />
              {linkCopied ? 'Copied!' : 'Copy link'}
            </button>
            {!bottle.is_mine && (
              <button
                type="button"
                onClick={onCatch}
                className="flex-1 min-w-[8rem] py-2 rounded-xl text-xs font-semibold text-white"
                style={{ background: C.brownDk }}
              >
                Catch a bottle
              </button>
            )}
          </div>
        </>
      )}
    </ModalShell>
  );
}

function CatchBottleModal({ onClose, onCaught }: { onClose: () => void; onCaught: () => void }) {
  const C = useVaultColors();
  const [catching, setCatching] = useState(false);
  const [caught, setCaught] = useState<CaughtBottle | null>(null);
  const [error, setError] = useState('');

  async function handleCatch() {
    setCatching(true);
    setError('');
    setCaught(null);
    try {
      const res = await apiFetch('bottles/catch/', { method: 'POST' });
      if (res.status === 404) {
        setError('The cosmic sea is empty for now. Try again later. 🌌');
        return;
      }
      if (!res.ok) throw new Error('catch failed');
      const data = await res.json();
      setTimeout(() => {
        setCaught(data);
        onCaught();
      }, 900);
    } catch {
      setError('Could not reach the void. Check your connection.');
    } finally {
      setTimeout(() => setCatching(false), 900);
    }
  }

  const m = caught ? emotionMeta(caught.emotion_type) : null;

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: C.text }}>
        <span>🌊</span> Catch a bottle
      </h2>
      <div className="min-h-[180px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {catching && !caught ? (
            <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <motion.div animate={{ rotate: [0, -12, 12, 0], y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} className="text-6xl">
                🍾
              </motion.div>
              <p className="mt-3 text-sm" style={{ color: C.text2 }}>Reaching into the void…</p>
            </motion.div>
          ) : caught && m ? (
            <motion.div
              key={caught.id}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full rounded-xl p-5"
              style={{ background: C.white, border: `1px solid ${m.color}55`, boxShadow: `0 6px 24px ${m.color}22` }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ background: `${m.color}22`, color: m.color }}>
                  {m.emoji} {m.label}
                </span>
                <RelativeTime date={caught.created_at} className="text-xs block" style={{ color: C.text2 }} />
              </div>
              <p className="text-lg leading-relaxed whitespace-pre-line" style={{ color: C.text }}>{caught.message}</p>
              <div className="text-xs mt-4" style={{ color: C.text2 }}>👤 From anonymous traveler #{caught.sender_anon_id}</div>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center" style={{ color: C.text2 }}>
              <div className="text-6xl mb-3">🌌</div>
              <p className="text-sm">Tap below to catch a drifting bottle.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {error && <div className="text-sm text-center mb-3" style={{ color: '#b9770f' }}>{error}</div>}
      <button
        onClick={handleCatch}
        disabled={catching}
        className="w-full rounded-xl py-3 font-semibold text-white transition-all disabled:opacity-60"
        style={{ background: `linear-gradient(90deg, ${C.brownDk}, ${C.brown})`, boxShadow: C.btnShadow }}
      >
        {catching ? 'Searching…' : caught ? 'Catch another' : 'Catch a bottle'}
      </button>
    </ModalShell>
  );
}

