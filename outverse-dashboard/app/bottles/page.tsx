'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  PaperAirplaneIcon,
  Squares2X2Icon,
  Cog6ToothIcon,
  MapPinIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import WorldShell from '@/components/world/WorldShell';
import EmotionVaultMap, { type VaultMapMarker } from '@/components/vault/EmotionVaultMap';
import Link from 'next/link';
import { readVaultMapStyle, type VaultMapStyle } from '@/lib/vaultMapStyle';
import { readSettingsPrefs } from '@/lib/settingsPrefs';
import { formatRelativeTime } from '../../utils/dateFormatter';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';
import { searchLocation } from '@/lib/geocode';
import { formatBottleTimeLeft } from '@/utils/bottleTime';

import { apiUrl } from '@/lib/api';

const BASE = apiUrl('bottles');

const PALETTES = {
  light: {
    cream: '#FBF3EE',
    card: '#F5E4DB',
    card2: '#F9ECE4',
    white: '#FFFFFF',
    brown: '#A0563B',
    brownDk: '#854330',
    text: '#3D2B22',
    text2: '#9A8278',
    line: 'rgba(160,86,59,0.14)',
    headerBg: 'rgba(251,243,238,0.85)',
    overlay: 'rgba(61,43,34,0.45)',
    shadowSm: '0 2px 10px rgba(160,86,59,0.06)',
    btnShadow: '0 6px 20px rgba(160,86,59,0.35)',
    modalShadow: '0 20px 60px rgba(61,43,34,0.3)',
    progressBg: 'rgba(0,0,0,0.06)',
    fabShadow: '0 4px 16px rgba(160,86,59,0.5)',
  },
  dark: {
    cream: '#1a1a2e',
    card: '#23234a',
    card2: '#2d1b4a',
    white: '#2a2a45',
    brown: '#c49a6c',
    brownDk: '#a0563b',
    text: '#F5F6FA',
    text2: '#B3B3B3',
    line: 'rgba(106,0,255,0.18)',
    headerBg: 'rgba(26,26,46,0.9)',
    overlay: 'rgba(10,10,34,0.65)',
    shadowSm: '0 2px 10px rgba(106,0,255,0.12)',
    btnShadow: '0 6px 20px rgba(106,0,255,0.25)',
    modalShadow: '0 20px 60px rgba(0,0,0,0.45)',
    progressBg: 'rgba(255,255,255,0.08)',
    fabShadow: '0 4px 16px rgba(106,0,255,0.35)',
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
  expires_at?: string;
  is_mine?: boolean;
};
type CaughtBottle = {
  id: number;
  message: string;
  emotion_type: string;
  created_at: string;
  sender_anon_id: string;
};

function EmotionVaultContent() {
  const C = useVaultColors();
  const { theme } = useTheme();
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
  const [placeLabels, setPlaceLabels] = useState<Record<number, string>>({});
  const [mapStyle, setMapStyle] = useState<VaultMapStyle>(() =>
    typeof window !== 'undefined' ? readVaultMapStyle() : 'street',
  );
  const [showOwnOnMap, setShowOwnOnMap] = useState(true);
  const [hideOthersRecent, setHideOthersRecent] = useState(true);

  const loadData = useCallback(async () => {
    const prefs = readSettingsPrefs();
    setShowOwnOnMap(prefs.showOwnMessageOnMap);
    setHideOthersRecent(prefs.hideOthersInRecent);
    try {
      const [dRes, mRes, rRes, mineRes] = await Promise.all([
        apiFetch('bottles/dashboard/'),
        apiFetch('bottles/map/'),
        apiFetch('bottles/recent/'),
        apiFetch('bottles/my_bottles/?active=1'),
      ]);
      if (dRes.ok) setDashboard(await dRes.json());
      if (mRes.ok) {
        const data: ApiBottle[] = await mRes.json();
        setMarkers(
          data
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
                showOwnMessage: prefs.showOwnMessageOnMap,
              };
            }),
        );
      }
      if (rRes.ok) setRecent(await rRes.json());
      if (mineRes.ok) {
        const mine = await mineRes.json();
        setMyActive(Array.isArray(mine) ? mine : []);
      }
    } catch {
      // backend offline — keep empty states
    }
  }, []);

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
      const next: Record<number, string> = {};
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
    brown: C.brown,
    brownDk: C.brownDk,
    white: C.white,
    text: C.text,
    text2: C.text2,
    line: C.line,
    btnShadow: C.btnShadow,
  };

  return (
    <WorldShell colors={{ cream: C.cream, text: C.text }}>
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: C.brown }}>
                Emotion Vault
              </h1>
              <p className="text-sm mt-0.5" style={{ color: C.text2 }}>
                Global map of drifting bottles — each vanishes after 24 hours
              </p>
            </div>
            <Link
              href="/settings"
              className="p-2.5 rounded-xl shrink-0 inline-flex"
              style={{ background: C.white, color: C.text2, border: `1px solid ${C.line}` }}
              aria-label="Settings"
            >
              <Cog6ToothIcon className="h-5 w-5" />
            </Link>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT */}
          <div className="lg:col-span-3 order-2 lg:order-1 space-y-6" id="timeline">
            <MoodTimeline timeline={timeline} />
            <MonthlySummary insights={insights} happyPct={happyPct} />
            <MoodInsights insights={insights} />
          </div>

          {/* CENTER */}
          <div className="lg:col-span-6 order-1 lg:order-2" id="map">
            <EmotionVaultMap
              markers={markers}
              variant={theme === 'dark' ? 'dark' : 'light'}
              colors={vaultColors}
              height={480}
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

            {/* stats bar */}
            <div
              className="flex flex-wrap items-center justify-between gap-2 mt-4 px-4 py-3 rounded-xl text-sm"
              style={{ background: C.card2, border: `1px solid ${C.line}` }}
            >
              <span className="flex items-center gap-2" style={{ color: C.text2 }}>
                Current mood:
                {currentMood ? (
                  <span className="px-2.5 py-1 rounded-full font-medium" style={{ background: `${currentMood.color}26`, color: currentMood.color }}>
                    {currentMood.emoji} {currentMood.label}
                  </span>
                ) : (
                  <span style={{ color: C.text2 }}>—</span>
                )}
              </span>
              <span style={{ color: C.text2 }}>
                <b style={{ color: C.text }}>{thrown}</b> thrown · <b style={{ color: C.text }}>{caught}</b> caught
              </span>
            </div>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-3 order-3 space-y-4" id="bottles">
            <div className="hidden lg:flex flex-col gap-3">
              <button
                onClick={() => setThrowOpen(true)}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold text-white transition hover:scale-[1.02]"
                style={{ background: C.brownDk, boxShadow: C.btnShadow }}
              >
                <PaperAirplaneIcon className="h-5 w-5" />
                Throw bottle
              </button>
              <button
                onClick={() => setCatchOpen(true)}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold transition"
                style={{ background: C.white, color: C.text, border: `1px solid ${C.line}` }}
              >
                <Squares2X2Icon className="h-5 w-5" />
                Catch bottle
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

            <h3 className="text-sm font-semibold" style={{ color: C.text }}>Recent drifting bottles</h3>
            {recent.length === 0 && (
              <div className="rounded-xl p-4 text-sm" style={{ background: C.card2, color: C.text2, border: `1px solid ${C.line}` }}>
                No drifting bottles right now — throw one with location to appear on the map for 24 hours. 🍶
              </div>
            )}
            {recent.map((b) => {
              const m = emotionMeta(b.emotion_type);
              const place =
                placeLabels[b.id] ??
                (b.location_lat != null ? 'On map' : null);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => openBottlePreview(b)}
                  className="w-full rounded-xl p-4 text-left transition hover:opacity-90"
                  style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
                >
                  {place && (
                    <div className="flex items-center gap-1.5 text-xs font-medium mb-2" style={{ color: C.brown }}>
                      <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
                      {place}
                    </div>
                  )}
                  {b.message && (!hideOthersRecent || b.is_mine) && (
                    <p className="text-sm line-clamp-2 mb-2" style={{ color: C.text }}>
                      {b.is_mine ? b.message : ''}
                    </p>
                  )}
                  {!b.is_mine && hideOthersRecent && (
                    <p className="text-xs mb-2 italic" style={{ color: C.text2 }}>
                      Message hidden — catch a bottle to read it
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: `${m.color}22`, color: m.color }}>
                      {m.emoji} {m.label}
                    </span>
                    <span className="text-xs" style={{ color: C.text2 }}>
                      {formatRelativeTime(new Date(b.created_at))}
                    </span>
                  </div>
                  {b.expires_at && (
                    <p className="text-[11px] mt-2" style={{ color: C.text2 }}>
                      ⏳ Vanishes in {formatBottleTimeLeft(b.expires_at)}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

      <AnimatePresence>
        {throwOpen && (
          <ThrowBottleModal onClose={() => setThrowOpen(false)} onThrown={loadData} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {catchOpen && (
          <CatchBottleModal onClose={() => setCatchOpen(false)} onCaught={loadData} />
        )}
        {(previewBottle || previewMissing) && (
          <BottlePreviewModal
            bottle={previewBottle}
            missing={previewMissing}
            placeLabel={previewBottle ? placeLabels[previewBottle.id] : undefined}
            hideOthersRecent={hideOthersRecent}
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
    </WorldShell>
  );
}

export default function EmotionVaultPage() {
  const C = useVaultColors();
  return (
    <Suspense
      fallback={
        <WorldShell colors={{ cream: C.cream, text: C.text }}>
          <div className="py-20 text-center text-sm" style={{ color: C.text2 }}>
            Loading vault…
          </div>
        </WorldShell>
      }
    >
      <EmotionVaultContent />
    </Suspense>
  );
}

// ----------------------------- Sub-components -----------------------------

function MoodTimeline({ timeline }: { timeline: TimelineDay[] }) {
  const C = useVaultColors();
  return (
    <div className="rounded-2xl p-4" style={{ background: C.card2, border: `1px solid ${C.line}` }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: C.text }}>Mood timeline (30 days)</h3>
      <div className="grid grid-cols-7 gap-1.5">
        {timeline.map((t) => {
          const has = !!t.emotion;
          const m = emotionMeta(t.emotion);
          return (
            <div
              key={t.day}
              title={has ? `Day ${t.day} · ${m.label}` : `Day ${t.day}`}
              className="aspect-square rounded-lg flex flex-col items-center justify-center text-[10px]"
              style={{
                background: has ? `${m.color}22` : C.white,
                border: `1px solid ${has ? `${m.color}40` : C.line}`,
              }}
            >
              <span style={{ color: C.text2, lineHeight: 1 }}>{t.day}</span>
              <span className="text-[13px] mt-0.5" style={{ lineHeight: 1 }}>{has ? m.emoji : '·'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthlySummary({ insights, happyPct }: { insights: Insight[]; happyPct: number }) {
  const C = useVaultColors();
  const top = insights.slice(0, 3);
  const fallback = [
    { emotion: 'joy', pct: happyPct || 0 },
    { emotion: 'sad', pct: 0 },
    { emotion: 'calm', pct: 0 },
  ];
  const rows = top.length ? top : fallback;

  return (
    <div className="vault-happy-card" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: C.text }}>Monthly summary</h3>
      <div className="space-y-2.5">
        {rows.map((it) => {
          const m = emotionMeta(it.emotion);
          return (
            <div key={it.emotion}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: C.text }}>{m.label}</span>
                <span className="font-semibold" style={{ color: m.color }}>{it.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.progressBg }}>
                <div className="h-full rounded-full" style={{ width: `${it.pct}%`, background: m.color }} />
              </div>
            </div>
          );
        })}
      </div>
      {happyPct > 0 && (
        <p className="text-xs mt-3" style={{ color: C.text2 }}>
          Positive mood days this month: <b style={{ color: C.brown }}>{happyPct}%</b>
        </p>
      )}
    </div>
  );
}

function MoodInsights({ insights }: { insights: Insight[] }) {
  const C = useVaultColors();
  return (
    <div className="rounded-2xl p-4" style={{ background: C.card2, border: `1px solid ${C.line}` }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: C.text }}>Mood insights</h3>
      {insights.length === 0 ? (
        <p className="text-sm" style={{ color: C.text2 }}>Throw some bottles to see your mood insights.</p>
      ) : (
        <div className="space-y-3">
          {insights.map((it) => {
            const m = emotionMeta(it.emotion);
            return (
              <div key={it.emotion}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5" style={{ color: C.text }}>
                    <span>{m.emoji}</span> {m.label}
                  </span>
                  <span className="font-semibold" style={{ color: m.color }}>{it.pct}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: C.progressBg }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: m.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${it.pct}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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
        className="w-full max-w-md rounded-2xl p-6 relative"
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

function ThrowBottleModal({ onClose, onThrown }: { onClose: () => void; onThrown: () => void }) {
  const C = useVaultColors();
  const [message, setMessage] = useState('');
  const [emotion, setEmotion] = useState('mystery');
  const [shareLocation, setShareLocation] = useState(true);
  const [throwing, setThrowing] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

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
  hideOthersRecent,
  linkCopied,
  onCopyLink,
  onClose,
  onCatch,
}: {
  bottle: ApiBottle | null;
  missing: boolean;
  placeLabel?: string;
  hideOthersRecent: boolean;
  linkCopied: boolean;
  onCopyLink: () => void;
  onClose: () => void;
  onCatch: () => void;
}) {
  const C = useVaultColors();
  const m = bottle ? emotionMeta(bottle.emotion_type) : null;
  const showMessage =
    bottle?.is_mine || (!hideOthersRecent && bottle?.message);
  const canReadOthers = bottle && !bottle.is_mine;

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
          {showMessage && bottle.message ? (
            <p className="text-sm mt-4 leading-relaxed whitespace-pre-wrap" style={{ color: C.text }}>
              {bottle.message}
            </p>
          ) : canReadOthers ? (
            <p className="text-sm mt-4 italic" style={{ color: C.text2 }}>
              Message hidden — catch a bottle to read strangers&apos; whispers.
            </p>
          ) : null}
          {bottle.expires_at && (
            <p className="text-xs mt-3" style={{ color: C.text2 }}>
              ⏳ Vanishes in {formatBottleTimeLeft(bottle.expires_at)}
            </p>
          )}
          <p className="text-xs mt-2" style={{ color: C.text2 }}>
            {formatRelativeTime(new Date(bottle.created_at))}
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
                <span className="text-xs" style={{ color: C.text2 }}>{formatRelativeTime(new Date(caught.created_at))}</span>
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

