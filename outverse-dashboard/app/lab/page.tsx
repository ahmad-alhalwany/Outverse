'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import WorldShell from '@/components/world/WorldShell';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';
import { getToken, getUser } from '@/lib/auth';
import { fetchDailyRitual, completeDailyRitual } from '@/lib/ritualApi';
import { relayQuestion } from '@/lib/differentiatorApi';
import InspirationRelayList from '@/components/lab/InspirationRelayList';
import type { RelayUser } from '@/lib/differentiatorApi';
import { useTheme } from '@/components/ThemeProvider';
import {
  ClockIcon,
  UsersIcon,
  FireIcon,
  TrophyIcon,
  PaperAirplaneIcon,
  MagnifyingGlassIcon,
  CheckBadgeIcon,
  PencilIcon,
  MusicalNoteIcon,
  SwatchIcon,
  ShareIcon,
  BookmarkIcon,
  InformationCircleIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

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
    shadow: '0 18px 40px rgba(124,58,237,0.12)',
    shadowSm: '0 8px 24px rgba(124,58,237,0.10)',
    btnShadow: '0 10px 24px rgba(124,58,237,0.24)',
    overlay: 'rgba(33,27,61,0.45)',
    successBg: '#e8f3ee',
    successText: '#2f8f6b',
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
    shadow: '0 18px 40px rgba(0,0,0,0.28)',
    shadowSm: '0 8px 24px rgba(0,0,0,0.22)',
    btnShadow: '0 10px 24px rgba(0,0,0,0.28)',
    overlay: 'rgba(10,8,24,0.65)',
    successBg: 'rgba(74,222,128,0.15)',
    successText: '#4ade80',
  },
};

const CATEGORIES = [
  { key: 'all', label: 'All', icon: InformationCircleIcon },
  { key: 'writing', label: 'Writing', icon: PencilIcon },
  { key: 'art', label: 'Art', icon: SwatchIcon },
  { key: 'music', label: 'Music', icon: MusicalNoteIcon },
  { key: 'experimental', label: 'Experimental', icon: FireIcon },
  { key: 'practical', label: 'Practical', icon: TrophyIcon },
] as const;

const FRIENDS = [
  {
    name: 'Amy',
    avatar:
      'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=160&q=80',
    active: true,
  },
  {
    name: 'Tom',
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
    active: false,
  },
  {
    name: 'Sara',
    avatar:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80',
    active: false,
  },
  {
    name: 'Mike',
    avatar:
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80',
    active: false,
  },
] as const;

type Challenge = {
  id: number;
  title: string;
  description: string;
  type: string;
  type_display: string;
  difficulty: string;
  cover_url: string;
  is_daily: boolean;
  is_ai_generated?: boolean;
  is_owner?: boolean;
  created_by?: {
    id?: number;
    username: string;
    first_name?: string;
    last_name?: string;
    avatar?: string | null;
  } | null;
  end_date: string;
  participants: number;
};

type ChallengeSubmission = {
  id: number;
  content: string;
  submitted_at?: string;
  created_at?: string;
  is_approved: boolean;
  user: {
    id?: number;
    username: string;
    first_name?: string;
    last_name?: string;
    avatar?: string | null;
  };
};

type ArchiveResponse = {
  results: Challenge[];
  page: number;
  page_size: number;
  has_more: boolean;
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
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!target || !now) return '--:--:--';
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return '00:00:00';
  const h = Math.floor(diff / 3.6e6);
  const m = Math.floor((diff % 3.6e6) / 6e4);
  const s = Math.floor((diff % 6e4) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatDate(value?: string) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString();
}

function displayName(user: ChallengeSubmission['user']) {
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return full || user.username || 'Anonymous';
}

function challengeMinutes(participants: number) {
  return Math.max(8, Math.min(18, Math.round(participants / 28)));
}

function archiveScore(participants: number) {
  return `${Math.max(76, Math.min(96, 72 + (participants % 25)))}%`;
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
  const [archivePage, setArchivePage] = useState(1);
  const [archiveHasMore, setArchiveHasMore] = useState(false);
  const [archiveLoadingMore, setArchiveLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [linkError, setLinkError] = useState('');
  const [ritualStreak, setRitualStreak] = useState<number | null>(null);
  const [ritualCompleted, setRitualCompleted] = useState(false);
  const [ritualQuestionId, setRitualQuestionId] = useState<number | null>(null);
  const [relayUsers, setRelayUsers] = useState<RelayUser[]>([]);
  const [completingRitual, setCompletingRitual] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const countdown = useCountdown(daily?.end_date);

  useEffect(() => {
    if (!getToken()) {
      setRitualStreak(null);
      setRitualCompleted(false);
      return;
    }
    void (async () => {
      const data = await fetchDailyRitual({ lang: 'en' });
      if (data) {
        setRitualStreak(data.streak);
        setRitualCompleted(data.ritual.completed);
        setRitualQuestionId(data.question?.id ?? null);
      } else {
        setRitualStreak(null);
        setRitualCompleted(false);
      }
    })();
  }, []);

  const loadArchive = useCallback(
    async (page: number, append: boolean) => {
      const res = await apiFetch(`challenges/archive/?type=${category}&page=${page}&page_size=12`);
      if (!res.ok) {
        throw new Error('archive failed');
      }
      const data: ArchiveResponse | Challenge[] = await res.json();
      if (Array.isArray(data)) {
        setArchive((prev) => (append ? [...prev, ...data] : data));
        setArchiveHasMore(data.length >= 12);
        setArchivePage(page);
        return;
      }
      setArchive((prev) => (append ? [...prev, ...data.results] : data.results));
      setArchiveHasMore(data.has_more);
      setArchivePage(data.page);
    },
    [category],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      // Ensure today's bright AI daily exists, then load stats + archive.
      const [dRes, sRes] = await Promise.all([
        apiFetchJson('challenges/ensure-daily/', { method: 'POST', json: { lang: 'en' } }),
        apiFetch('challenges/stats/'),
      ]);
      let ok = true;
      if (dRes.ok) {
        const d = await dRes.json();
        setDaily(d && d.id ? d : null);
      } else {
        const fallback = await apiFetch('challenges/daily/');
        if (fallback.ok) {
          const d = await fallback.json();
          setDaily(d && d.id ? d : null);
        } else {
          ok = false;
        }
      }
      if (sRes.ok) {
        setStats(await sRes.json());
      } else {
        ok = false;
      }
      await loadArchive(1, false);
      if (!ok) setLoadError(true);
    } catch {
      setDaily(null);
      setArchive([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [loadArchive]);

  const filteredArchive = useMemo(() => {
    const query = search.trim().toLowerCase();
    return archive.filter((challenge) => {
      const matchesQuery =
        !query ||
        challenge.title.toLowerCase().includes(query) ||
        challenge.description.toLowerCase().includes(query);
      const matchesCategory = category === 'all' || challenge.type === category;
      return matchesQuery && matchesCategory;
    });
  }, [archive, category, search]);

  const closeChallengeModal = useCallback(() => {
    setViewChallenge(null);
    if (searchParams.get('challenge')) router.replace('/lab');
  }, [router, searchParams]);

  const openChallenge = useCallback(
    (challenge: Challenge) => {
      setViewChallenge(challenge);
      router.replace(`/lab?challenge=${challenge.id}`);
    },
    [router],
  );

  const onChallengeSubmitted = useCallback((challengeId: number, participants: number) => {
    setDaily((current) => (current && current.id === challengeId ? { ...current, participants } : current));
    setArchive((list) =>
      list.map((challenge) => (challenge.id === challengeId ? { ...challenge, participants } : challenge)),
    );
    setViewChallenge((current) => (current && current.id === challengeId ? { ...current, participants } : current));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = searchParams.get('challenge');
    if (!id) return;
    const num = parseInt(id, 10);
    if (Number.isNaN(num)) return;
    void (async () => {
      try {
        const res = await apiFetch(`challenges/${num}/`);
        if (res.ok) {
          const data = await res.json();
          if (data?.id) setViewChallenge(data);
          else setLinkError('Could not find that challenge.');
        } else {
          setLinkError('Could not load that challenge.');
        }
      } catch {
        setLinkError('Could not load that challenge. Check the connection.');
      }
    })();
  }, [searchParams]);

  async function completeRitual() {
    if (!getToken() || completingRitual) return;
    setCompletingRitual(true);
    try {
      const data = await completeDailyRitual({ lang: 'en' });
      if (data) {
        setRitualCompleted(data.ritual.completed);
        setRitualStreak(data.streak);
        const qid = data.question?.id ?? ritualQuestionId;
        if (qid) {
          setRelayUsers(await relayQuestion(qid));
        }
      }
    } finally {
      setCompletingRitual(false);
    }
  }

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

  async function loadMoreArchive() {
    if (archiveLoadingMore || !archiveHasMore) return;
    setArchiveLoadingMore(true);
    try {
      await loadArchive(archivePage + 1, true);
    } catch {
      setLoadError(true);
    } finally {
      setArchiveLoadingMore(false);
    }
  }

  return (
    <WorldShell colors={C} maxWidth="max-w-5xl">
      <div className="lab-shell">
        <div className="lab-topbar">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: C.brown }}>
              Worlds · Lab
            </p>
            <h1 className="lab-title">Daily Challenge</h1>
            <p className="lab-subtitle">Let your creativity flow</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ritualStreak !== null && (
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text }}
                title="Daily ritual streak"
              >
                <FireIcon className="h-4 w-4 shrink-0" style={{ color: C.brown }} />
                <span>
                  {ritualStreak > 0 ? `${ritualStreak} day streak` : 'Start a streak today'}
                </span>
                {ritualCompleted && (
                  <span className="text-xs font-medium" style={{ color: C.successText }}>
                    · Done today
                  </span>
                )}
              </div>
            )}
            {ritualQuestionId && !ritualCompleted && getToken() ? (
              <button
                type="button"
                onClick={() => void completeRitual()}
                disabled={completingRitual}
                className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white"
                style={{ background: C.brownDk }}
              >
                {completingRitual ? 'Completing…' : 'Complete daily ritual'}
              </button>
            ) : null}
            <Link href="/lab/history" className="lab-history-link">
              My Lab History
            </Link>
          </div>
        </div>

        <InspirationRelayList users={relayUsers} />

        {linkError && (
          <div
            className="rounded-2xl p-3 mb-4 text-sm flex items-center justify-between gap-3"
            style={{ background: C.card2, color: C.text2, border: `1px solid ${C.line}` }}
          >
            <span>{linkError}</span>
            <button type="button" onClick={() => setLinkError('')} className="font-semibold" style={{ color: C.brownDk }}>
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="rounded-[28px] p-10 text-center" style={{ background: C.card2, color: C.text2 }}>
            Loading today&apos;s challenge…
          </div>
        ) : loadError ? (
          <div className="rounded-[28px] p-10 text-center" style={{ background: C.card2, border: `1px solid ${C.line}` }}>
            <p className="font-semibold mb-2" style={{ color: C.text }}>
              Could not load the lab
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: C.brownDk }}
            >
              Try again
            </button>
          </div>
        ) : !daily ? (
          <div
            className="rounded-[28px] p-10 text-center"
            style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text2 }}
          >
            No active daily challenge right now. Check the archive below. ✨
          </div>
        ) : (
          <>
            <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="lab-daily-card">
              <div className="lab-daily-meta">
                <div className="lab-countdown-pill">
                  <ClockIcon className="h-4 w-4" />
                  <span>{countdown} remaining</span>
                </div>
                <div className="lab-action-icons">
                  <button type="button" aria-label="Save challenge" className="lab-icon-btn">
                    <BookmarkIcon className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Share challenge" className="lab-icon-btn">
                    <ShareIcon className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label="Challenge info" className="lab-icon-btn">
                    <InformationCircleIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <h2 className="lab-question">{daily.title}</h2>
              <p className="text-sm mt-2 mb-3 opacity-80" style={{ color: '#E9E1FA' }}>
                {daily.is_ai_generated
                  ? '✨ Crafted by Cosmory AI — bright ideas only, no darkness.'
                  : '✨ Today’s bright Lab prompt.'}
              </p>
              {daily.description ? (
                <p className="text-sm mb-4 opacity-75" style={{ color: '#E9E1FA' }}>
                  {daily.description}
                </p>
              ) : null}

              <textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={5}
                maxLength={500}
                placeholder="Start writing..."
                className="lab-response-box"
              />

              <div className="lab-daily-footer">
                <div className="lab-daily-stats">
                  <span className="lab-inline-stat">
                    <UsersIcon className="h-4 w-4" /> {daily.participants.toLocaleString()} people writing
                  </span>
                  <span className="lab-inline-stat">
                    <ClockIcon className="h-4 w-4" /> avg. {challengeMinutes(daily.participants)} min
                  </span>
                </div>
                <div className="lab-submit-wrap">
                  <AnimatePresence>
                    {submitted && (
                      <motion.span
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-sm font-medium"
                        style={{ color: C.successText }}
                      >
                        Submitted! 🎉
                      </motion.span>
                    )}
                  </AnimatePresence>
                  <button onClick={() => void submit()} disabled={submitting} className="lab-submit-btn">
                    {submitting ? 'Submitting…' : 'Submit Challenge'}
                  </button>
                </div>
              </div>
              {error && (
                <div className="text-sm mt-2" style={{ color: '#c0392b' }}>
                  {error}
                </div>
              )}
            </motion.section>

            <div className="lab-category-row">
              {CATEGORIES.filter((item) => item.key !== 'practical').map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => setCategory(item.key)}
                    className={`lab-category-pill ${category === item.key ? 'lab-category-pill--active' : ''}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <section className="lab-section-head">
              <div className="flex items-center justify-between gap-3">
                <h3 className="lab-section-title">Challenge Friends</h3>
                <span className="lab-see-all">See All</span>
              </div>
              <div className="lab-friends-row">
                {FRIENDS.map((friend) => (
                  <div key={friend.name} className="lab-friend">
                    <div className="lab-friend-avatar-wrap">
                      <div className="lab-friend-avatar" style={{ backgroundImage: `url(${friend.avatar})` }} />
                      <span className={`lab-friend-status ${friend.active ? 'lab-friend-status--active' : ''}`} />
                    </div>
                    <span>{friend.name}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <div className="lab-archive-head">
          <h3 className="lab-section-title">Community Challenges</h3>
          {getToken() ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-white"
              style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}
            >
              <PlusIcon className="h-4 w-4" />
              Publish challenge
            </button>
          ) : null}
        </div>

        <div className="relative mb-4">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.text2 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search challenges..."
            className="w-full rounded-full pl-10 pr-4 py-2.5 text-sm outline-none"
            style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          />
        </div>

        {filteredArchive.length === 0 ? (
          <div
            className="rounded-[28px] p-8 text-center mt-4"
            style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text2 }}
          >
            No past challenges match your search yet.
          </div>
        ) : (
          <>
            <div className="lab-archive-grid">
              {filteredArchive.map((challenge) => (
                <ArchiveCard
                  key={challenge.id}
                  ch={challenge}
                  isDaily={daily?.id === challenge.id}
                  onOpen={() => openChallenge(challenge)}
                />
              ))}
            </div>
            {archiveHasMore && !search.trim() ? (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMoreArchive()}
                  disabled={archiveLoadingMore}
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: C.brownDk }}
                >
                  {archiveLoadingMore ? 'Loading…' : 'Load more challenges'}
                </button>
              </div>
            ) : null}
          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          <StatCard icon={UsersIcon} value={stats?.participants ?? 0} label="Participants" />
          <StatCard icon={FireIcon} value={`${stats?.success_rate ?? 0}%`} label="Success Rate" />
          <StatCard icon={TrophyIcon} value={stats?.challenges ?? 0} label="Challenges" />
        </div>
      </div>

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
      <AnimatePresence>
        {showCreate && (
          <CreateChallengeModal
            onClose={() => setShowCreate(false)}
            onCreated={(challenge) => {
              setShowCreate(false);
              setArchive((prev) => [challenge, ...prev]);
              setViewChallenge(challenge);
              router.replace(`/lab?challenge=${challenge.id}`);
            }}
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
  const me = getUser();
  const isOwner = Boolean(ch.is_owner || me?.is_staff || (me?.id && ch.created_by?.id === me.id));
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [submissionsError, setSubmissionsError] = useState(false);
  const [moderatingId, setModeratingId] = useState<number | null>(null);

  const loadSubmissions = useCallback(async () => {
    setLoadingSubmissions(true);
    setSubmissionsError(false);
    try {
      const res = await apiFetch(`challenges/${ch.id}/submissions/`);
      if (!res.ok) throw new Error('failed');
      setSubmissions(await res.json());
    } catch {
      setSubmissions([]);
      setSubmissionsError(true);
    } finally {
      setLoadingSubmissions(false);
    }
  }, [ch.id]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  async function moderate(submissionId: number, approve: boolean) {
    setModeratingId(submissionId);
    try {
      const res = await apiFetchJson(`challenges/${ch.id}/submissions/${submissionId}/approve/`, {
        method: 'PATCH',
        json: { is_approved: approve },
      });
      if (res.ok) await loadSubmissions();
      else setError('Could not update submission.');
    } catch {
      setError('Could not update submission.');
    } finally {
      setModeratingId(null);
    }
  }

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
        const msg = data.error || 'Submit failed';
        // Already submitted — refresh list so their entry is visible instead of looking "missing".
        if (typeof msg === 'string' && /already submitted/i.test(msg)) {
          setSubmitted(true);
          await loadSubmissions();
        }
        throw new Error(msg);
      }
      setSubmitted(true);
      setResponse('');
      onSubmitted(ch.id, ch.participants + 1);
      await loadSubmissions();
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
        className="w-full max-w-2xl rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: C.cream, border: `1px solid ${C.line}` }}
      >
        <div
          className="h-32 shrink-0 bg-cover bg-center"
          style={{
            background: ch.cover_url
              ? `url(${mediaUrl(ch.cover_url)}) center/cover`
              : `linear-gradient(135deg, ${C.card}, ${C.card2})`,
          }}
        />
        <div className="p-5 relative overflow-y-auto flex-1">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full text-lg flex items-center justify-center"
            style={{ background: C.card, color: C.text }}
            aria-label="Close"
          >
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
            {(ch.is_ai_generated || ch.is_daily) && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee' }}>
                AI · bright only
              </span>
            )}
            {ch.difficulty && (
              <span
                className="px-2.5 py-1 rounded-full text-xs"
                style={{ background: C.white, color: C.text2, border: `1px solid ${C.line}` }}
              >
                {ch.difficulty}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold mt-2" style={{ color: C.text }}>
            {ch.title}
          </h2>
          <p className="text-xs mt-1" style={{ color: C.text2 }}>
            By{' '}
            {ch.is_daily || ch.is_ai_generated
              ? 'Cosmory AI'
              : ch.created_by
                ? displayName(ch.created_by)
                : 'Community'}
          </p>
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
          {error && (
            <p className="text-sm mt-2" style={{ color: '#c0392b' }}>
              {error}
            </p>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3">
            {submitted && (
              <span className="text-sm font-medium" style={{ color: C.successText }}>
                {ch.is_daily || ch.is_ai_generated
                  ? 'Submitted! 🎉'
                  : 'Submitted — waiting for the author to approve.'}
              </span>
            )}
            <button
              type="button"
              onClick={() => void submitEntry()}
              disabled={submitting}
              className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white disabled:opacity-60"
              style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`, boxShadow: C.btnShadow }}
            >
              <PaperAirplaneIcon className="h-4 w-4" />
              {submitting ? 'Submitting…' : 'Submit entry'}
            </button>
          </div>

          <div className="mt-6 border-t pt-5" style={{ borderColor: C.line }}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-base font-semibold" style={{ color: C.text }}>
                Community submissions
              </h3>
              <span className="text-xs" style={{ color: C.text2 }}>
                {submissions.length} shown
              </span>
            </div>
            <p className="text-xs mb-3" style={{ color: C.text2 }}>
              {isOwner && !ch.is_daily
                ? 'You own this challenge — approve or hide entries below.'
                : 'Community entries appear after the challenge author approves them.'}{' '}
              <Link href="/lab/history" className="font-semibold underline" style={{ color: C.brownDk }}>
                Lab history
              </Link>
            </p>
            {loadingSubmissions ? (
              <p className="text-sm" style={{ color: C.text2 }}>
                Loading submissions…
              </p>
            ) : submissionsError ? (
              <div className="rounded-2xl p-4 text-sm flex items-center justify-between gap-3" style={{ background: C.card2, color: C.text2 }}>
                <span>Could not load submissions.</span>
                <button
                  type="button"
                  onClick={() => void loadSubmissions()}
                  className="font-semibold shrink-0"
                  style={{ color: C.brownDk }}
                >
                  Retry
                </button>
              </div>
            ) : submissions.length === 0 ? (
              <div className="rounded-2xl p-4 text-sm" style={{ background: C.card2, color: C.text2 }}>
                No community submissions yet.
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="rounded-2xl p-4"
                    style={{ background: C.white, border: `1px solid ${C.line}` }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="h-10 w-10 rounded-full bg-center bg-cover shrink-0"
                        style={{
                          background: submission.user.avatar
                            ? `url(${mediaUrl(submission.user.avatar)}) center/cover`
                            : `linear-gradient(135deg, ${C.card}, ${C.card2})`,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm" style={{ color: C.text }}>
                            {displayName(submission.user)}
                          </span>
                          {submission.is_approved ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                              style={{ background: C.successBg, color: C.successText }}
                            >
                              <CheckBadgeIcon className="h-3.5 w-3.5" />
                              Approved
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                              style={{ background: 'rgba(251, 191, 36, 0.18)', color: '#fbbf24' }}
                            >
                              Pending review
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm whitespace-pre-wrap" style={{ color: C.text2 }}>
                          {submission.content}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <p className="text-xs" style={{ color: C.text2 }}>
                            {formatDate(submission.submitted_at || submission.created_at)}
                          </p>
                          {isOwner && !ch.is_daily ? (
                            <div className="ml-auto flex gap-2">
                              {!submission.is_approved ? (
                                <button
                                  type="button"
                                  disabled={moderatingId === submission.id}
                                  onClick={() => void moderate(submission.id, true)}
                                  className="rounded-full px-3 py-1 text-[11px] font-bold text-white disabled:opacity-60"
                                  style={{ background: C.brown }}
                                >
                                  Approve
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={moderatingId === submission.id}
                                  onClick={() => void moderate(submission.id, false)}
                                  className="rounded-full px-3 py-1 text-[11px] font-semibold disabled:opacity-60"
                                  style={{ background: C.card2, color: C.text2 }}
                                >
                                  Hide
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CreateChallengeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (challenge: Challenge) => void;
}) {
  const C = useLabColors();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('writing');
  const [difficulty, setDifficulty] = useState('easy');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function onCoverChange(file: File | null) {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : '');
  }

  async function submit() {
    if (!title.trim()) {
      setError('Add a title for your challenge.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const end = new Date();
      end.setDate(end.getDate() + 14);
      const form = new FormData();
      form.append('title', title.trim());
      form.append('description', description.trim());
      form.append('type', type);
      form.append('difficulty', difficulty);
      form.append('end_date', end.toISOString());
      if (coverFile) form.append('cover_image', coverFile);
      const res = await apiFetch('challenges/', { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const fieldErr =
          typeof data.cover_image?.[0] === 'string'
            ? data.cover_image[0]
            : typeof data.detail === 'string'
              ? data.detail
              : data.error;
        throw new Error(fieldErr || 'Could not publish challenge.');
      }
      onCreated((await res.json()) as Challenge);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish challenge.');
    } finally {
      setBusy(false);
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
        className="w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        style={{ background: C.cream, border: `1px solid ${C.line}` }}
      >
        <h2 className="text-lg font-bold" style={{ color: C.text }}>
          Publish a community challenge
        </h2>
        <p className="text-sm mt-1 mb-4" style={{ color: C.text2 }}>
          You moderate the entries. Keep it bright and creative.
        </p>
        <label className="block text-xs font-semibold mb-1" style={{ color: C.text2 }}>
          Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mb-3"
          style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          placeholder="e.g. Invent a festival for kindness"
        />
        <label className="block text-xs font-semibold mb-1" style={{ color: C.text2 }}>
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none mb-3"
          style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          placeholder="What should people create?"
        />
        <label className="block text-xs font-semibold mb-1" style={{ color: C.text2 }}>
          Cover image <span className="font-normal opacity-70">(optional)</span>
        </label>
        <div
          className="mb-3 rounded-xl overflow-hidden"
          style={{ border: `1px dashed ${C.line}`, background: C.white }}
        >
          {coverPreview ? (
            <div className="relative h-36 bg-center bg-cover" style={{ backgroundImage: `url(${coverPreview})` }}>
              <button
                type="button"
                onClick={() => onCoverChange(null)}
                className="absolute top-2 right-2 rounded-lg px-2 py-1 text-xs font-semibold"
                style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-1 h-28 cursor-pointer px-4 text-center">
              <span className="text-sm font-semibold" style={{ color: C.brown }}>
                Upload image
              </span>
              <span className="text-xs" style={{ color: C.text2 }}>
                JPG, PNG, WebP or GIF · max 5MB
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file && file.size > 5 * 1024 * 1024) {
                    setError('Cover image must be 5MB or smaller.');
                    e.target.value = '';
                    return;
                  }
                  setError('');
                  onCoverChange(file);
                }}
              />
            </label>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: C.text2 }}>
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
            >
              {CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: C.text2 }}>
              Difficulty
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>
        {error ? (
          <p className="text-sm mb-3" style={{ color: '#c0392b' }}>
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: C.card2, color: C.text2 }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}
          >
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ icon: Icon, value, label }: { icon: typeof UsersIcon; value: number | string; label: string }) {
  const C = useLabColors();
  return (
    <div className="rounded-[24px] p-4 text-center" style={{ background: C.white, border: `1px solid ${C.line}` }}>
      <Icon className="h-5 w-5 mx-auto mb-1.5" style={{ color: C.brown }} />
      <div className="text-xl font-bold" style={{ color: C.text }}>
        {value}
      </div>
      <div className="text-xs" style={{ color: C.text2 }}>
        {label}
      </div>
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
      className="lab-archive-card"
      style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
    >
      <div
        className="lab-archive-image"
        style={{ background: ch.cover_url ? `url(${mediaUrl(ch.cover_url)}) center/cover` : `linear-gradient(135deg, ${C.card}, ${C.card2})` }}
      />
      <div className="p-4">
        <h4 className="font-semibold mt-1 leading-snug text-[1.05rem]" style={{ color: C.text }}>
          {ch.title}
        </h4>
        <div className="mt-2 flex items-center justify-between gap-3 text-sm" style={{ color: C.text2 }}>
          <span>{typeLabel(ch.type)}</span>
          <span style={{ color: '#7C3AED', fontWeight: 700 }}>{isDaily ? 'Today' : archiveScore(ch.participants)}</span>
        </div>
      </div>
    </motion.button>
  );
}