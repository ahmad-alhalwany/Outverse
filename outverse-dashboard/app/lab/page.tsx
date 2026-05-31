'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { apiFetchJson } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';
import {
  ClockIcon,
  UsersIcon,
  FireIcon,
  TrophyIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';

import { apiUrl } from '@/lib/api';

const BASE = apiUrl('challenges');

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
    shadow: '0 8px 28px rgba(160,86,59,0.10)',
    shadowSm: '0 2px 12px rgba(160,86,59,0.06)',
    btnShadow: '0 6px 18px rgba(160,86,59,0.3)',
    overlay: 'rgba(61,43,34,0.45)',
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
    shadow: '0 8px 28px rgba(106,0,255,0.15)',
    shadowSm: '0 2px 12px rgba(106,0,255,0.12)',
    btnShadow: '0 6px 18px rgba(106,0,255,0.25)',
    overlay: 'rgba(10,10,34,0.65)',
  },
};

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'writing', label: 'Writing' },
  { key: 'art', label: 'Art' },
  { key: 'music', label: 'Music' },
  { key: 'experimental', label: 'Experimental' },
  { key: 'practical', label: 'Practical' },
];

type Challenge = {
  id: number;
  title: string;
  description: string;
  type: string;
  type_display: string;
  difficulty: string;
  cover_url: string;
  is_daily: boolean;
  end_date: string;
  participants: number;
};

type Stats = { participants: number; success_rate: number; challenges: number };

function useLabColors() {
  const { theme } = useTheme();
  return PALETTES[theme];
}

function typeLabel(key: string) {
  return CATEGORIES.find((c) => c.key === key)?.label || key;
}

function useCountdown(target?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return '--:--:--';
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return '00:00:00';
  const h = Math.floor(diff / 3.6e6);
  const m = Math.floor((diff % 3.6e6) / 6e4);
  const s = Math.floor((diff % 6e4) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function WeirdnessLabContent() {
  const C = useLabColors();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [daily, setDaily] = useState<Challenge | null>(null);
  const [archive, setArchive] = useState<Challenge[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [viewChallenge, setViewChallenge] = useState<Challenge | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const countdown = useCountdown(daily?.end_date);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [dRes, aRes, sRes] = await Promise.all([
        fetch(`${BASE}/daily/`),
        fetch(`${BASE}/archive/?type=${category}`),
        fetch(`${BASE}/stats/`),
      ]);
      let ok = true;
      if (dRes.ok) {
        const d = await dRes.json();
        setDaily(d && d.id ? d : null);
      } else ok = false;
      if (aRes.ok) setArchive(await aRes.json());
      else ok = false;
      if (sRes.ok) setStats(await sRes.json());
      if (!ok) setLoadError(true);
    } catch {
      setDaily(null);
      setArchive([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [category]);

  const closeChallengeModal = useCallback(() => {
    setViewChallenge(null);
    if (searchParams.get('challenge')) router.replace('/lab');
  }, [router, searchParams]);

  const openChallenge = useCallback(
    (ch: Challenge) => {
      setViewChallenge(ch);
      router.replace(`/lab?challenge=${ch.id}`);
    },
    [router],
  );

  const onChallengeSubmitted = useCallback((challengeId: number, participants: number) => {
    setDaily((d) => (d && d.id === challengeId ? { ...d, participants } : d));
    setArchive((list) =>
      list.map((c) => (c.id === challengeId ? { ...c, participants } : c)),
    );
    setViewChallenge((v) => (v && v.id === challengeId ? { ...v, participants } : v));
    load();
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = searchParams.get('challenge');
    if (!id) return;
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) return;
    (async () => {
      try {
        const res = await fetch(`${BASE}/${num}/`);
        if (res.ok) {
          const data = await res.json();
          if (data?.id) setViewChallenge(data);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [searchParams]);

  async function submit() {
    if (!daily || !response.trim()) {
      setError('Write something first ✍️');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetchJson(`challenges/${daily.id}/submissions/`, {
        method: 'POST',
        json: { content: response.trim() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'failed');
      }
      setSubmitted(true);
      setResponse('');
      onChallengeSubmitted(daily.id, daily.participants + 1);
      setTimeout(() => setSubmitted(false), 3500);
    } catch {
      setError('Could not submit. Check the connection.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <WorldShell colors={C} maxWidth="max-w-5xl">
        <div className="mb-5">
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: C.brown }}>🧪 Weirdness Lab</h1>
          <p className="text-sm" style={{ color: C.text2 }}>Daily challenges and a creative archive.</p>
        </div>

        {/* Daily challenge hero */}
        {loading ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>
            Loading today&apos;s challenge…
          </div>
        ) : loadError ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, border: `1px solid ${C.line}` }}>
            <p className="font-semibold mb-2" style={{ color: C.text }}>Could not load the lab</p>
            <button
              type="button"
              onClick={() => load()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: C.brownDk }}
            >
              Try again
            </button>
          </div>
        ) : !daily ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text2 }}>
            No active daily challenge right now. Check the archive below. ✨
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 md:p-6"
            style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: C.shadow }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: C.brown }}>
                Daily Challenge
              </span>
              <span className="flex items-center gap-1.5 text-sm font-mono" style={{ color: C.brownDk }}>
                <ClockIcon className="h-4 w-4" /> {countdown}
              </span>
            </div>

            <h2 className="text-lg md:text-xl font-bold mt-3" style={{ color: C.text }}>{daily.title}</h2>
            {daily.description && (
              <p className="text-sm mt-1" style={{ color: C.text2 }}>{daily.description}</p>
            )}

            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Share your creative response…"
              className="w-full rounded-xl px-4 py-3 mt-4 outline-none resize-none text-sm"
              style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
            />

            <div className="flex items-center justify-between flex-wrap gap-3 mt-3">
              <span className="flex items-center gap-1.5 text-sm" style={{ color: C.text2 }}>
                <UsersIcon className="h-4 w-4" /> {daily.participants.toLocaleString()} participants
              </span>
              <div className="flex items-center gap-3">
                <AnimatePresence>
                  {submitted && (
                    <motion.span
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-medium"
                      style={{ color: '#2f8f6b' }}
                    >
                      Submitted! 🎉
                    </motion.span>
                  )}
                </AnimatePresence>
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white disabled:opacity-60"
                  style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`, boxShadow: C.btnShadow }}
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  {submitting ? 'Submitting…' : 'Submit Challenge'}
                </button>
              </div>
            </div>
            {error && <div className="text-sm mt-2" style={{ color: '#c0392b' }}>{error}</div>}
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <StatCard icon={UsersIcon} value={stats?.participants ?? 0} label="Participants" />
          <StatCard icon={FireIcon} value={`${stats?.success_rate ?? 0}%`} label="Success Rate" />
          <StatCard icon={TrophyIcon} value={stats?.challenges ?? 0} label="Challenges" />
        </div>

        {/* Category filter */}
        <div className="flex items-center justify-between mt-8 mb-3">
          <h3 className="text-lg font-bold" style={{ color: C.text }}>Challenge Archive</h3>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition"
              style={{
                background: category === c.key ? C.brown : C.white,
                color: category === c.key ? '#fff' : C.text2,
                border: `1px solid ${category === c.key ? C.brown : C.line}`,
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Archive grid */}
        {archive.length === 0 ? (
          <div className="rounded-2xl p-8 text-center mt-4" style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text2 }}>
            No past challenges in this category yet.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {archive.map((ch) => (
              <ArchiveCard
                key={ch.id}
                ch={ch}
                isDaily={daily?.id === ch.id}
                onOpen={() => openChallenge(ch)}
              />
            ))}
          </div>
        )}

      <AnimatePresence>
        {viewChallenge && (
          <ChallengeViewModal
            ch={viewChallenge}
            isTodayDaily={daily?.id === viewChallenge.id}
            onClose={closeChallengeModal}
            onSubmitted={onChallengeSubmitted}
          />
        )}
      </AnimatePresence>
    </WorldShell>
  );
}

export default function WeirdnessLabPage() {
  const C = useLabColors();
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: C.cream, color: C.text2 }}>
          Loading…
        </div>
      }
    >
      <WeirdnessLabContent />
    </Suspense>
  );
}

function ChallengeViewModal({
  ch,
  isTodayDaily,
  onClose,
  onSubmitted,
}: {
  ch: Challenge;
  isTodayDaily?: boolean;
  onClose: () => void;
  onSubmitted: (challengeId: number, participants: number) => void;
}) {
  const C = useLabColors();
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function submitEntry() {
    if (!response.trim()) {
      setError('Write something first ✍️');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetchJson(`challenges/${ch.id}/submissions/`, {
        method: 'POST',
        json: { content: response.trim() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Submit failed');
      }
      setSubmitted(true);
      setResponse('');
      onSubmitted(ch.id, ch.participants + 1);
      setTimeout(() => setSubmitted(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit. Check the connection.');
    } finally {
      setSubmitting(false);
    }
  }

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
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: C.cream, border: `1px solid ${C.line}` }}
      >
        <div
          className="h-32 shrink-0 bg-cover bg-center"
          style={{
            background: ch.cover_url
              ? `url(${ch.cover_url}) center/cover`
              : `linear-gradient(135deg, ${C.card}, ${C.card2})`,
          }}
        />
        <div className="p-5 relative overflow-y-auto flex-1">
          <button type="button" onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full text-lg flex items-center justify-center" style={{ background: C.card, color: C.text }} aria-label="Close">
            ×
          </button>
          <div className="flex flex-wrap gap-2 pr-10">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.card2, color: C.brown }}>
              {typeLabel(ch.type)}
            </span>
            {isTodayDaily && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ background: C.brown }}>
                Today&apos;s daily
              </span>
            )}
            {ch.difficulty && (
              <span className="px-2.5 py-1 rounded-full text-xs" style={{ background: C.white, color: C.text2, border: `1px solid ${C.line}` }}>
                {ch.difficulty}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold mt-2" style={{ color: C.text }}>
            {ch.title}
          </h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: C.text2 }}>
            {ch.description || 'No description for this challenge.'}
          </p>
          <p className="text-xs mt-3 flex items-center gap-1" style={{ color: C.text2 }}>
            <UsersIcon className="h-3.5 w-3.5" />
            {ch.participants.toLocaleString()} participants
          </p>

          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Share your creative response…"
            className="w-full rounded-xl px-3 py-2.5 mt-4 outline-none resize-none text-sm"
            style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          />
          {error && <p className="text-sm mt-2" style={{ color: '#c0392b' }}>{error}</p>}
          <div className="flex items-center justify-between gap-2 mt-3">
            {submitted && (
              <span className="text-sm font-medium" style={{ color: '#2f8f6b' }}>
                Submitted! 🎉
              </span>
            )}
            <button
              type="button"
              onClick={submitEntry}
              disabled={submitting}
              className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white disabled:opacity-60"
              style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`, boxShadow: C.btnShadow }}
            >
              <PaperAirplaneIcon className="h-4 w-4" />
              {submitting ? 'Submitting…' : 'Submit entry'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ icon: Icon, value, label }: { icon: typeof UsersIcon; value: number | string; label: string }) {
  const C = useLabColors();
  return (
    <div className="rounded-2xl p-4 text-center" style={{ background: C.white, border: `1px solid ${C.line}` }}>
      <Icon className="h-5 w-5 mx-auto mb-1.5" style={{ color: C.brown }} />
      <div className="text-xl font-bold" style={{ color: C.text }}>{value}</div>
      <div className="text-xs" style={{ color: C.text2 }}>{label}</div>
    </div>
  );
}

function ArchiveCard({
  ch,
  isDaily,
  onOpen,
}: {
  ch: Challenge;
  isDaily?: boolean;
  onOpen: () => void;
}) {
  const C = useLabColors();
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden text-left w-full"
      style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
    >
      <div
        className="h-32 bg-center bg-cover"
        style={{ background: ch.cover_url ? `url(${ch.cover_url}) center/cover` : `linear-gradient(135deg, ${C.card}, ${C.card2})` }}
      />
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.card2, color: C.brown }}>
            {typeLabel(ch.type)}
          </span>
          {isDaily && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold text-white" style={{ background: C.brown }}>
              Daily
            </span>
          )}
        </div>
        <h4 className="font-semibold mt-2 leading-snug" style={{ color: C.text }}>{ch.title}</h4>
        <div className="flex items-center gap-1.5 text-xs mt-2" style={{ color: C.text2 }}>
          <UsersIcon className="h-3.5 w-3.5" /> {ch.participants.toLocaleString()} participants
        </div>
      </div>
    </motion.button>
  );
}

