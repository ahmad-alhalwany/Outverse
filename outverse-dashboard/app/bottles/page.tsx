'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { searchLocation, searchLocationSuggestions, reverseGeocodeLabel, type GeocodeHit } from '@/lib/geocode';
import { formatBottleTimeLeft } from '@/utils/bottleTime';
import {
  DEMO_BOTTLES,
  DEMO_DASHBOARD,
  demoMarkers,
  demoPlaceLabels,
  moodSummaryRows,
  shouldUseVaultDemo,
} from '@/lib/vaultDemoData';
import { computeRegionMoods } from '@/lib/vaultRegionMood';
import { getUser } from '@/lib/auth';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { apiUrl } from '@/lib/api';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import { useLocale } from '@/components/LocaleProvider';
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

type Emotion = { key: string; labelKey: string; emoji: string; color: string };

const EMOTIONS: Emotion[] = [
  { key: 'joy', labelKey: 'bottles.emotionJoy', emoji: '☀️', color: '#F2A93B' },
  { key: 'hope', labelKey: 'bottles.emotionHope', emoji: '🌅', color: '#3FB6A0' },
  { key: 'calm', labelKey: 'bottles.emotionCalm', emoji: '🌊', color: '#4FA3D1' },
  { key: 'love', labelKey: 'bottles.emotionLove', emoji: '💗', color: '#E86A9C' },
  { key: 'sad', labelKey: 'bottles.emotionSad', emoji: '🌧️', color: '#6E7BD1' },
  { key: 'lonely', labelKey: 'bottles.emotionLonely', emoji: '🌙', color: '#9385D6' },
  { key: 'anxious', labelKey: 'bottles.emotionAnxious', emoji: '🌪️', color: '#E08653' },
  { key: 'nostalgic', labelKey: 'bottles.emotionNostalgic', emoji: '📻', color: '#C49A5A' },
  { key: 'mystery', labelKey: 'bottles.emotionMystery', emoji: '✨', color: '#A86BB0' },
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
  const { t } = useLocale();
  const { theme } = useTheme();
  const confirm = useConfirm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [throwOpen, setThrowOpen] = useState(false);
  const [catchOpen, setCatchOpen] = useState(false);
  const [mapPickMode, setMapPickMode] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
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
              label: t(em.labelKey),
              emotion: b.emotion_type,
              expiresAt: b.expires_at,
              isMine: b.is_mine,
              message: b.is_mine && !prefs.showOwnMessageOnMap ? null : b.message,
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
  const regionMoods = useMemo(
    () =>
      computeRegionMoods(
        markers.map((m) => ({
          id: m.id,
          lat: m.lat,
          lng: m.lng,
          emotion: m.emotion || m.label,
          emoji: m.emoji,
          color: m.color,
          label: m.label,
        })),
      ),
    [markers],
  );

  const startMapPick = useCallback(() => {
    setThrowOpen(false);
    setMapPickMode(true);
  }, []);

  const handleMapPicked = useCallback(async (lat: number, lng: number) => {
    const label = (await reverseGeocodeLabel(lat, lng)) || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
    setPickedLocation({ lat, lng, label });
    setMapPickMode(false);
    setFlyTarget({ lat, lng, zoom: 14 });
    setThrowOpen(true);
  }, []);
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

  const displayRecent = recent;
  const previewMessage = (b: ApiBottle) => b.message || null;

  const deleteBottle = async (id: number) => {
    if (!(await confirm(t('bottles.confirmDeleteBottle'), { danger: true, confirmLabel: t('common.delete') }))) return;
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
            <h1 className="vault-header__title">{t('bottles.title')}</h1>
            {demoMode && <span className="vault-demo-badge">{t('bottles.demoData')}</span>}
          </div>
          <div className="vault-header__search">
            <div className="vault-header__search-wrap">
              <MapPinIcon className="vault-header__search-icon" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                placeholder={t('bottles.searchLocationPlaceholder')}
              />
            </div>
          </div>
          <div className="vault-header__actions">
            <Link href="/settings" className="vault-icon-btn" aria-label={t('nav.settings')}>
              <Cog6ToothIcon className="h-5 w-5" />
            </Link>
            <Link href={authUser?.id ? `/profile/${authUser.id}` : '/login'} className="vault-avatar">
              {(authUser?.username || '?').slice(0, 2).toUpperCase()}
            </Link>
          </div>
        </header>

        {loadError && (
          <div className="vault-error-banner">
            <span>{t('bottles.loadError')}</span>
            <button type="button" onClick={() => void loadData()}>{t('bottles.retry')}</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT */}
          <div className="lg:col-span-3 order-2 lg:order-1 space-y-4" id="timeline">
            <div className="rounded-3xl p-4" style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-bold" style={{ color: C.text }}>{t('bottles.filtersTitle')}</h2>
                <div className="flex rounded-full p-1" style={{ background: C.card2 }}>
                  <button type="button" onClick={() => setActiveTab('vault')} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: activeTab === 'vault' ? C.white : 'transparent', color: activeTab === 'vault' ? C.brown : C.text2 }}>{t('bottles.myVaultTab')}</button>
                  <button type="button" onClick={() => setActiveTab('catches')} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: activeTab === 'catches' ? C.white : 'transparent', color: activeTab === 'catches' ? C.brown : C.text2 }}>{t('bottles.myCatchesTab')}</button>
                </div>
              </div>
              {activeTab === 'vault' && (
                <label className="flex items-center gap-2 text-xs mb-2" style={{ color: C.text2 }}>
                  <input type="checkbox" checked={includeExpired} onChange={(e) => setIncludeExpired(e.target.checked)} />
                  {t('bottles.includeExpired')}
                </label>
              )}
              <div className="space-y-3">
                <select value={emotionFilter} onChange={(e) => setEmotionFilter(e.target.value)} className="w-full rounded-2xl px-3 py-2 text-sm outline-none" style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text }}>
                  <option value="all">{t('bottles.allEmotions')}</option>
                  {EMOTIONS.map((emotion) => (
                    <option key={emotion.key} value={emotion.key}>{t(emotion.labelKey)}</option>
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
              regions={regionMoods}
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
              pickMode={mapPickMode}
              onPickLocation={(lat, lng) => void handleMapPicked(lat, lng)}
              pickPreview={pickedLocation}
              onCancelPick={() => {
                setMapPickMode(false);
                setThrowOpen(true);
              }}
            />

            {markers.length > 0 && (
              <p className="text-xs mt-2 text-center" style={{ color: C.text2 }}>
                {markers.length === 1
                  ? t('bottles.driftingBottlesOne', { count: String(markers.length) })
                  : t('bottles.driftingBottlesMany', { count: String(markers.length) })}
              </p>
            )}

            <div className="vault-stats-bar">
              <span className="flex items-center gap-2 flex-wrap">
                {t('bottles.currentMood')}
                {currentMood ? (
                  <span
                    className="vault-mood-pill"
                    style={{ background: `${currentMood.color}20`, color: currentMood.color }}
                  >
                    {currentMood.emoji} {t(currentMood.labelKey)}
                  </span>
                ) : (
                  <span>—</span>
                )}
              </span>
              <span>
                <strong style={{ color: 'var(--vault-text)' }}>{thrown}</strong> {t('bottles.bottlesThrown')} ·{' '}
                <strong style={{ color: 'var(--vault-text)' }}>{caught}</strong> {t('bottles.bottlesCaught')}
              </span>
            </div>

            <div className="mt-5 rounded-3xl p-4" style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold" style={{ color: C.text }}>{activeTab === 'vault' ? t('bottles.myBottlesTitle') : t('bottles.myCatchesTitle')}</h2>
                <span className="text-xs" style={{ color: C.text2 }}>{t('bottles.entriesCount', { count: String(activeTab === 'vault' ? myActive.length : caughtBottles.length) })}</span>
              </div>
              <div className="space-y-3">
                {(activeTab === 'vault' ? myActive : caughtBottles).length === 0 ? (
                  <p className="text-sm" style={{ color: C.text2 }}>
                    {activeTab === 'vault' ? t('bottles.noBottlesMatch') : t('bottles.noCatchesMatch')}
                  </p>
                ) : (
                  (activeTab === 'vault' ? myActive : caughtBottles).map((bottle) => {
                    const emotion = emotionMeta(bottle.emotion_type);
                    return (
                      <div key={bottle.id} className="rounded-2xl p-4" style={{ background: C.card2, border: `1px solid ${C.line}` }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold" style={{ background: `${emotion.color}22`, color: emotion.color }}>
                              {emotion.emoji} {t(emotion.labelKey)}
                            </span>
                            <p className="mt-2 text-sm leading-relaxed" style={{ color: C.text }}>{bottle.message || t('bottles.caughtBottleFallback')}</p>
                            <p className="mt-2 text-xs" style={{ color: C.text2 }}>
                              <RelativeTime date={activeTab === 'catches' && bottle.caught_at ? bottle.caught_at : bottle.created_at} />
                            </p>
                          </div>
                          {activeTab === 'vault' && (
                            <button type="button" onClick={() => deleteBottle(bottle.id)} className="rounded-full p-2" style={{ background: C.white, color: C.brown, border: `1px solid ${C.line}` }} aria-label={t('bottles.deleteBottleLabel')}>
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
                {t('bottles.throwBottleBtn')}
              </button>
              <button type="button" onClick={() => setCatchOpen(true)} className="vault-btn-secondary">
                <Squares2X2Icon className="h-5 w-5" />
                {t('bottles.catchBottleBtn')}
              </button>
            </div>

            {myActive.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: C.text }}>
                  {t('bottles.activeBottlesTitle', { count: String(myActive.length) })}
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
                          {m.emoji} {t(m.labelKey)}
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
              {t('bottles.recentBottlesTitle')}
            </h3>
            {displayRecent.length === 0 && (
              <div className="vault-card text-sm" style={{ color: 'var(--vault-muted)' }}>
                {t('bottles.noDriftingBottles')}
              </div>
            )}
            {displayRecent.map((b) => {
              const m = emotionMeta(b.emotion_type);
              const place =
                placeLabels[b.id] ??
                (b as ApiBottle & { place?: string }).place ??
                (b.location_lat != null ? t('bottles.onMap') : null);
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
                      {m.emoji} {t(m.labelKey)}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: 'var(--vault-muted)' }}>{t('bottles.anonymous')}</span>
                      <RelativeTime date={b.created_at} className="text-xs" style={{ color: 'var(--vault-muted)' }} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      <AnimatePresence>
        {(throwOpen || mapPickMode) && (
          <ThrowBottleModal
            open={throwOpen}
            ideaId={searchParams.get('idea_id')}
            initialLocation={pickedLocation}
            onRequestMapPick={startMapPick}
            onLocationChange={setPickedLocation}
            onClose={() => {
              setThrowOpen(false);
              setMapPickMode(false);
            }}
            onThrown={() => {
              setPickedLocation(null);
              void loadData();
            }}
          />
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
            onCatch={async () => {
              if (!previewBottle) return;
              const res = await apiFetchJson('bottles/catch/', {
                method: 'POST',
                json: { bottle_id: previewBottle.id },
              });
              if (res.ok) {
                closeBottlePreview();
                void loadData();
                return;
              }
              if (res.status === 404) {
                closeBottlePreview();
                void loadData();
                return;
              }
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
  const { t } = useLocale();
  return (
    <div className="vault-card">
      <h3 className="vault-card__title">{t('bottles.moodTimelineTitle')}</h3>
      <div className="vault-timeline-grid">
        {timeline.map((day) => {
          const has = !!day.emotion;
          const m = emotionMeta(day.emotion);
          return (
            <div
              key={day.day}
              title={has ? t('bottles.dayLabel', { day: String(day.day), mood: t(m.labelKey) }) : t('bottles.dayLabelNoMood', { day: String(day.day) })}
              className={`vault-timeline-cell${day.day === 1 ? ' vault-timeline-cell--active' : ''}`}
              style={
                has
                  ? { background: `${m.color}14`, borderColor: `${m.color}35` }
                  : undefined
              }
            >
              <span>{day.day}</span>
              <span className="vault-timeline-cell__emoji">{has ? m.emoji : '·'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthlySummary({ insights, happyPct }: { insights: Insight[]; happyPct: number }) {
  const { t } = useLocale();

  return (
    <div className="vault-card">
      <h3 className="vault-card__title">{t('bottles.moodInsights')}</h3>
      {insights.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--vault-muted)' }}>{t('bottles.moodInsightsEmpty')}</p>
      ) : (
        moodSummaryRows(insights).map((row) => (
          <div key={row.key}>
            <div className="vault-summary-row">
              <span>
                {row.emoji} {t(`bottles.mood${row.key.charAt(0).toUpperCase()}${row.key.slice(1)}`)}
              </span>
              <span style={{ color: row.color, fontWeight: 600 }}>{row.pct}%</span>
            </div>
            <div className="vault-summary-bar">
              <div className="vault-summary-bar__fill" style={{ width: `${row.pct}%`, background: row.color }} />
            </div>
          </div>
        ))
      )}
      {happyPct > 0 && (
        <p className="text-xs mt-2" style={{ color: 'var(--vault-muted)' }}>
          {t('bottles.positiveMoodDays')} <strong>{happyPct}%</strong>
        </p>
      )}
    </div>
  );
}

function ModalShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const C = useVaultColors();
  const { t } = useLocale();
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
          aria-label={t('common.close')}
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

function ThrowBottleModal({
  open,
  onClose,
  onThrown,
  ideaId,
  initialLocation,
  onRequestMapPick,
  onLocationChange,
}: {
  open: boolean;
  onClose: () => void;
  onThrown: () => void;
  ideaId?: string | null;
  initialLocation?: { lat: number; lng: number; label: string } | null;
  onRequestMapPick: () => void;
  onLocationChange: (loc: { lat: number; lng: number; label: string } | null) => void;
}) {
  const C = useVaultColors();
  const { t } = useLocale();
  const [message, setMessage] = useState(ideaId ? t('bottles.ideaSparkPrefix', { id: ideaId }) : '');
  const [emotion, setEmotion] = useState('mystery');
  const [location, setLocation] = useState<{ lat: number; lng: number; label: string } | null>(
    initialLocation ?? null,
  );
  const [placeQuery, setPlaceQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeHit[]>([]);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const [locating, setLocating] = useState(false);
  const [throwing, setThrowing] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [polishNote, setPolishNote] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (initialLocation) setLocation(initialLocation);
  }, [initialLocation]);

  function applyLocation(next: { lat: number; lng: number; label: string } | null) {
    setLocation(next);
    onLocationChange(next);
  }

  async function handleUseMyGps() {
    setLocating(true);
    setError('');
    const loc = await getLocation();
    setLocating(false);
    if (!loc) {
      setError(t('bottles.gpsError'));
      return;
    }
    const label = (await reverseGeocodeLabel(loc.lat, loc.lng)) || t('bottles.myLocationFallback');
    applyLocation({ ...loc, label });
  }

  async function runPlaceSearch() {
    const q = placeQuery.trim();
    if (!q) return;
    setSearchingPlace(true);
    setError('');
    const hits = await searchLocationSuggestions(q, 5);
    setSearchingPlace(false);
    setSuggestions(hits);
    if (!hits.length) setError(t('bottles.noPlacesFound'));
  }

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
      setError(t('bottles.writeMessageFirst'));
      return;
    }
    if (!location) {
      setError(t('bottles.chooseLocationFirst'));
      return;
    }
    setError('');
    setThrowing(true);
    try {
      const res = await apiFetchJson('bottles/throw/', {
        method: 'POST',
        json: {
          message: message.trim(),
          emotion_type: emotion,
          location_lat: location.lat,
          location_lng: location.lng,
        },
      });
      if (!res.ok) throw new Error('throw failed');
      setDone(true);
      onThrown();
      setTimeout(onClose, 1600);
    } catch {
      setError(t('bottles.bottleSlippedAway'));
    } finally {
      setThrowing(false);
    }
  }

  return open || done ? (
    <ModalShell onClose={onClose}>
      {done ? (
        <div className="text-center py-8">
          <motion.div initial={{ y: 40, opacity: 0, scale: 0.6 }} animate={{ y: -30, opacity: 1, scale: 1 }} transition={{ duration: 1.2, type: 'spring' }} className="text-6xl">
            🍶
          </motion.div>
          <p className="mt-4" style={{ color: C.text2 }}>{t('bottles.bottleDrifting')}</p>
        </div>
      ) : (
        <form onSubmit={handleThrow}>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: C.text }}>
            {t('bottles.throwTitle')}
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
                {t(em.labelKey)}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('bottles.messagePlaceholder')}
            maxLength={500}
            rows={4}
            className="w-full rounded-xl p-3 outline-none resize-none"
            style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          />

          <div className="mt-3 rounded-xl p-3" style={{ background: C.card2, border: `1px solid ${C.line}` }}>
            <p className="text-xs font-semibold mb-2" style={{ color: C.text }}>
              {t('bottles.whereAppear')}
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                onClick={() => void handleUseMyGps()}
                disabled={locating}
                className="rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: C.white, color: C.brown, border: `1px solid ${C.line}` }}
              >
                {locating ? t('bottles.locating') : t('bottles.useMyGps')}
              </button>
              <button
                type="button"
                onClick={onRequestMapPick}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: C.brownDk }}
              >
                {t('bottles.pickOnMap')}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), void runPlaceSearch())}
                placeholder={t('bottles.searchPlacePlaceholder')}
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
              />
              <button
                type="button"
                onClick={() => void runPlaceSearch()}
                disabled={searchingPlace}
                className="rounded-xl px-3 py-2 text-xs font-semibold text-white"
                style={{ background: C.brown }}
              >
                {searchingPlace ? '…' : t('bottles.find')}
              </button>
            </div>
            {suggestions.length > 0 && (
              <ul className="mt-2 max-h-28 overflow-y-auto rounded-xl" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                {suggestions.map((hit) => (
                  <li key={`${hit.lat}-${hit.lng}-${hit.label}`}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:opacity-80"
                      style={{ color: C.text, borderBottom: `1px solid ${C.line}` }}
                      onClick={() => {
                        applyLocation({ lat: hit.lat, lng: hit.lng, label: hit.label });
                        setSuggestions([]);
                        setPlaceQuery(hit.label);
                      }}
                    >
                      {hit.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {location ? (
              <p className="text-xs mt-2 font-medium" style={{ color: C.brown }}>
                {t('bottles.selectedLocation', { label: location.label })}
                <button
                  type="button"
                  className="ml-2 underline opacity-80"
                  onClick={() => applyLocation(null)}
                >
                  {t('bottles.clear')}
                </button>
              </p>
            ) : (
              <p className="text-xs mt-2" style={{ color: C.text2 }}>
                {t('bottles.locationRequired')}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs" style={{ color: C.text2 }}>{message.length}/500</span>
            <button
              type="button"
              onClick={() => void handlePolish()}
              disabled={polishing || !message.trim()}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}
            >
              {polishing ? t('bottles.polishing') : t('bottles.polishTone')}
            </button>
          </div>
          {polishNote ? (
            <p className="text-xs mt-1" style={{ color: C.text2 }}>✨ {polishNote}</p>
          ) : null}
          {error && <div className="text-sm mt-2" style={{ color: '#c0392b' }}>{error}</div>}
          <button
            type="submit"
            disabled={throwing}
            className="mt-4 w-full rounded-xl py-3 font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`, boxShadow: C.btnShadow }}
          >
            {throwing ? t('bottles.driftingAway') : t('bottles.sendToCosmos')}
          </button>
        </form>
      )}
    </ModalShell>
  ) : null;
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
  onCatch: () => void | Promise<void>;
}) {
  const C = useVaultColors();
  const { t } = useLocale();
  const m = bottle ? emotionMeta(bottle.emotion_type) : null;
  const [opening, setOpening] = useState(false);

  async function handleOpen() {
    if (opening) return;
    setOpening(true);
    try {
      await onCatch();
    } finally {
      setOpening(false);
    }
  }

  return (
    <ModalShell onClose={onClose}>
      {missing || !bottle ? (
        <div className="text-center py-6">
          <p className="text-4xl mb-3">🌊</p>
          <p className="font-semibold" style={{ color: C.text }}>
            {t('bottles.bottleNotFound')}
          </p>
          <p className="text-sm mt-2" style={{ color: C.text2 }}>
            {t('bottles.bottleNotFoundHint')}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 pr-8">
            <span
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: `${m!.color}22`, color: m!.color }}
            >
              {m!.emoji} {t(m!.labelKey)}
            </span>
            {bottle.is_mine && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: C.card2, color: C.brown }}>
                {t('bottles.yours')}
              </span>
            )}
          </div>
          {placeLabel && (
            <p className="flex items-center gap-1.5 text-xs font-medium mt-3" style={{ color: C.brown }}>
              <MapPinIcon className="h-3.5 w-3.5" />
              {placeLabel}
            </p>
          )}
          <p className="text-xs mt-2" style={{ color: C.text2 }}>{t('bottles.fromAnonymousTraveler')}</p>
          {bottle.message && (
            <p className="text-sm mt-4 leading-relaxed whitespace-pre-wrap" style={{ color: C.text }}>
              {bottle.message}
            </p>
          )}
          {bottle.expires_at && (
            <p className="text-xs mt-3" style={{ color: C.text2 }}>
              {t('bottles.vanishesIn', { time: formatBottleTimeLeft(bottle.expires_at) })}
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
              {linkCopied ? t('bottles.copied') : t('bottles.copyLink')}
            </button>
            {!bottle.is_mine && (
              <button
                type="button"
                onClick={() => void handleOpen()}
                disabled={opening}
                className="flex-1 min-w-[8rem] py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-60"
                style={{ background: C.brownDk }}
              >
                {opening ? t('bottles.opening') : t('bottles.openThisBottle')}
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
  const { t } = useLocale();
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
        setError(t('bottles.seaEmpty'));
        return;
      }
      if (!res.ok) throw new Error('catch failed');
      const data = await res.json();
      setTimeout(() => {
        setCaught(data);
        onCaught();
      }, 900);
    } catch {
      setError(t('bottles.couldNotReachVoid'));
    } finally {
      setTimeout(() => setCatching(false), 900);
    }
  }

  const m = caught ? emotionMeta(caught.emotion_type) : null;

  return (
    <ModalShell onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: C.text }}>
        {t('bottles.catchTitle')}
      </h2>
      <div className="min-h-[180px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {catching && !caught ? (
            <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
              <motion.div animate={{ rotate: [0, -12, 12, 0], y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} className="text-6xl">
                🍾
              </motion.div>
              <p className="mt-3 text-sm" style={{ color: C.text2 }}>{t('bottles.reachingIntoVoid')}</p>
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
                  {m.emoji} {t(m.labelKey)}
                </span>
                <RelativeTime date={caught.created_at} className="text-xs block" style={{ color: C.text2 }} />
              </div>
              <p className="text-lg leading-relaxed whitespace-pre-line" style={{ color: C.text }}>{caught.message}</p>
              <div className="text-xs mt-4" style={{ color: C.text2 }}>{t('bottles.fromAnonymousTravelerId', { id: String(caught.sender_anon_id) })}</div>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center" style={{ color: C.text2 }}>
              <div className="text-6xl mb-3">🌌</div>
              <p className="text-sm">{t('bottles.tapToCatch')}</p>
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
        {catching ? t('bottles.searching') : caught ? t('bottles.catchAnother') : t('bottles.catchABottleBtn')}
      </button>
    </ModalShell>
  );
}

