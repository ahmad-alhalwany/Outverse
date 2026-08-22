'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import EditProfileModal from '@/components/profile/EditProfileModal';
import FollowListModal from '@/components/profile/FollowListModal';
import { formatBottleTimeLeft } from '@/utils/bottleTime';
import {
  SparklesIcon,
  MapPinIcon,
  PencilSquareIcon,
  BriefcaseIcon,
  PlusIcon,
  TrashIcon,
  HeartIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  ArrowUpOnSquareIcon,
} from '@heroicons/react/24/outline';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';
import { postShareUrl } from '@/lib/shareUtils';
import { recordContentShare } from '@/lib/shareApi';
import { useLocale } from '@/components/LocaleProvider';
import { useTheme } from '@/components/ThemeProvider';
import { apiUrl, mediaUrl } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { apiFetch, apiFetchJson } from '@/lib/api';
import {
  emotionMeta,
  formatCount,
  happyDaysPercent,
} from '@/lib/profileEmotions';
import { mapPost } from '@/utils/postMapper';
import SubscribeTiersButton from '@/components/profile/SubscribeTiersButton';
import ProfileReelsGrid from '@/components/profile/ProfileReelsGrid';
import ProfileIdeasGrid from '@/components/profile/ProfileIdeasGrid';
import ProfileSocialMenu from '@/components/profile/ProfileSocialMenu';
import TipButton from '@/components/TipButton';
import ProfileStoryConstellations from '@/components/profile/ProfileStoryConstellations';
import type { SocialStatus } from '@/lib/socialApi';
import ReelsIcon from '@/components/icons/ReelsIcon';

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
    cover: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 35%, #7dd3fc 100%)',
    tabBg: '#EDE4DC',
    shadowSm: '0 2px 12px rgba(124,58,237,0.10)',
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
    cover: 'linear-gradient(135deg, #251B4D 0%, #1E1740 40%, #14102A 100%)',
    tabBg: '#1e1738',
    shadowSm: '0 2px 12px rgba(167,139,250,0.14)',
  },
};

const WEEK_LABEL_KEYS = ['profile.weekMon', 'profile.weekTue', 'profile.weekWed', 'profile.weekThu', 'profile.weekFri', 'profile.weekSat', 'profile.weekSun'];

type TabKey = 'posts' | 'reels' | 'ideas' | 'challenges' | 'stories' | 'bottles';

interface Profile {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  bio: string | null;
  location?: string;
  avatar: string | null;
  cover_photo?: string | null;
  posts_count: number;
  reels_count?: number;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  social?: SocialStatus;
  points?: number;
  karma?: number;
  achievements?: (string | { id?: number | string; icon?: string; title?: string; completed?: boolean })[];
  status?: string;
  badge_verified?: boolean;
  spender_tier?: 'none' | 'bronze' | 'silver' | 'gold';
}

const SPENDER_TIER_META: Record<'bronze' | 'silver' | 'gold', { emoji: string; labelKey: string; color: string }> = {
  bronze: { emoji: '🥉', labelKey: 'profile.tierBronze', color: '#B08D57' },
  silver: { emoji: '🥈', labelKey: 'profile.tierSilver', color: '#9CA3AF' },
  gold: { emoji: '🥇', labelKey: 'profile.tierGold', color: '#D4AF37' },
};

type ChallengeEntry = {
  id: number;
  content?: string;
  is_approved?: boolean;
  challenge?: { id?: number; title?: string };
};

type ForgeStory = {
  id: number;
  title: string;
  cover_url?: string;
  segment_count?: number;
  max_segments?: number;
  genre?: string;
};

type BottleEntry = {
  id: number;
  emotion_type: string;
  message: string;
  expires_at?: string;
};

type Experience = {
  id: number;
  title: string;
  organization: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description?: string;
};

type ExperienceForm = {
  title: string;
  organization: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  description: string;
};

const EMPTY_EXPERIENCE_FORM: ExperienceForm = {
  title: '',
  organization: '',
  start_date: '',
  end_date: '',
  is_current: false,
  description: '',
};

interface TimelineDay {
  day: number;
  date: string;
  emotion: string | null;
}

interface ProfileViewProps {
  userId: string;
}

function displayName(profile: Profile) {
  const full = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
  return full || profile.username;
}

function initials(name: string) {
  return name ? name.slice(0, 2).toUpperCase() : '??';
}

function postThumbnail(post: ReturnType<typeof mapPost>): string | null {
  if (post.images?.length) return post.images[0];
  if (post.videos?.length) return post.videos[0];
  return null;
}

function postTitle(text: string, fallback: string) {
  const line = (text || '').trim().split('\n')[0];
  if (!line) return fallback;
  return line.length > 48 ? `${line.slice(0, 48)}…` : line;
}

function reactionTotal(counts?: Record<string, number>) {
  if (!counts) return 0;
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

export default function ProfileView({ userId }: ProfileViewProps) {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<ReturnType<typeof mapPost>[]>([]);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [currentMood, setCurrentMood] = useState<string | null>(null);
  const [moodInsights, setMoodInsights] = useState<{ emotion: string; pct: number }[]>([]);
  const [futureMemory, setFutureMemory] = useState<{ id: number; text: string; tag: string; created_at: string } | null>(null);
  const [stories, setStories] = useState<ForgeStory[]>([]);
  const [challenges, setChallenges] = useState<ChallengeEntry[]>([]);
  const [bottles, setBottles] = useState<BottleEntry[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [experienceForm, setExperienceForm] = useState<ExperienceForm>(EMPTY_EXPERIENCE_FORM);
  const [editingExperienceId, setEditingExperienceId] = useState<number | null>(null);
  const [experienceBusy, setExperienceBusy] = useState(false);
  const [experienceError, setExperienceError] = useState('');
  const [tab, setTab] = useState<TabKey>('posts');
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null);
  const [followError, setFollowError] = useState('');
  const [copiedPostId, setCopiedPostId] = useState<number | null>(null);

  const authUser = useAuthUser();
  const isOwnProfile = authUser ? String(authUser.id) === String(userId) : false;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setProfileError(false);
    try {
      const [profileRes, postsRes, moodRes, storiesRes, challRes, bottlesRes, suggestionsRes, experienceRes, memoryRes] =
        await Promise.all([
          apiFetch(`users/${userId}/`),
          apiFetch(`posts/?author=${userId}`),
          isOwnProfile
            ? apiFetch('bottles/dashboard/')
            : Promise.resolve(new Response(JSON.stringify({ timeline: [], current_mood: null, insights: [] }), { status: 200 })),
          apiFetch(`forge/stories/?owner=${userId}`),
          apiFetch(`challenges/user_entries/?user=${userId}`),
          isOwnProfile
            ? apiFetch('bottles/my_bottles/?active=1')
            : Promise.resolve(new Response(JSON.stringify([]), { status: 200 })),
          apiFetch(`users/suggestions/?exclude=${userId}`),
          apiFetch(`users/${userId}/experience/`),
          apiFetch(`speculative/future-memories/?user=${userId}`),
        ]);
      if (profileRes.ok) {
        setProfile(await profileRes.json());
      } else if (profileRes.status !== 404) {
        setProfileError(true);
      }
      if (postsRes.ok) {
        const data = await postsRes.json();
        setPosts(Array.isArray(data) ? data.map(mapPost) : []);
      }
      if (moodRes.ok) {
        const mood = await moodRes.json();
        setTimeline(Array.isArray(mood.timeline) ? mood.timeline : []);
        setCurrentMood(mood.current_mood ?? null);
        setMoodInsights(Array.isArray(mood.insights) ? mood.insights : []);
      }
      if (storiesRes.ok) setStories(await storiesRes.json());
      if (challRes.ok) setChallenges(await challRes.json());
      if (bottlesRes.ok) setBottles(await bottlesRes.json());
      if (suggestionsRes.ok) setSuggestions(await suggestionsRes.json());
      if (experienceRes.ok) {
        const experienceData = await experienceRes.json();
        setExperiences(Array.isArray(experienceData) ? experienceData : experienceData?.results || []);
      }
      if (memoryRes.ok) {
        const memoryData = await memoryRes.json();
        const list = Array.isArray(memoryData) ? memoryData : memoryData?.results || [];
        setFutureMemory(list[0] || null);
      }
    } catch {
      setProfileError(true);
    } finally {
      setLoading(false);
    }
  }, [userId, isOwnProfile]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFollow = async () => {
    if (!profile) return;
    setFollowError('');
    try {
      const res = await apiFetchJson('users/follow/', {
        method: 'POST',
        json: { following_id: profile.id },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile({
          ...profile,
          is_following: data.is_following,
          followers_count: data.followers_count,
        });
      } else {
        const data = await res.json().catch(() => null);
        setFollowError(data?.error || t('profile.followError'));
      }
    } catch {
      setFollowError(t('profile.followError'));
    }
  };

  const resetExperienceForm = () => {
    setExperienceForm(EMPTY_EXPERIENCE_FORM);
    setEditingExperienceId(null);
    setExperienceError('');
  };

  const startEditExperience = (experience: Experience) => {
    setExperienceForm({
      title: experience.title || '',
      organization: experience.organization || '',
      start_date: experience.start_date || '',
      end_date: experience.end_date || '',
      is_current: !!experience.is_current,
      description: experience.description || '',
    });
    setEditingExperienceId(experience.id);
    setExperienceError('');
  };

  const saveExperience = async () => {
    if (!experienceForm.title.trim() || !experienceForm.organization.trim() || !experienceForm.start_date || experienceBusy) return;
    setExperienceBusy(true);
    setExperienceError('');
    const payload = {
      title: experienceForm.title.trim(),
      organization: experienceForm.organization.trim(),
      start_date: experienceForm.start_date,
      end_date: experienceForm.is_current ? null : experienceForm.end_date || null,
      is_current: experienceForm.is_current,
      description: experienceForm.description.trim(),
    };
    try {
      const res = await apiFetchJson(
        editingExperienceId ? `users/me/experience/${editingExperienceId}/` : 'users/me/experience/',
        {
          method: editingExperienceId ? 'PATCH' : 'POST',
          json: payload,
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || data?.title?.[0] || '');
      }
      const saved = (await res.json()) as Experience;
      setExperiences((prev) =>
        editingExperienceId
          ? prev.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...prev],
      );
      resetExperienceForm();
    } catch (err) {
      setExperienceError((err instanceof Error && err.message) || t('profile.saveExperienceError'));
    } finally {
      setExperienceBusy(false);
    }
  };

  const deleteExperience = async (experienceId: number) => {
    if (experienceBusy) return;
    setExperienceBusy(true);
    setExperienceError('');
    try {
      const res = await apiFetch(`users/me/experience/${experienceId}/`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('failed');
      setExperiences((prev) => prev.filter((item) => item.id !== experienceId));
      if (editingExperienceId === experienceId) resetExperienceForm();
    } catch {
      setExperienceError(t('profile.deleteExperienceError'));
    } finally {
      setExperienceBusy(false);
    }
  };

  const mappedPosts = useMemo(() => posts, [posts]);

  const handleShareCard = async (postId: number) => {
    if (typeof window === 'undefined') return;
    const url = postShareUrl(postId, 'copy');
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPostId(postId);
      void recordContentShare('post', postId, 'copy');
      setTimeout(() => setCopiedPostId((cur) => (cur === postId ? null : cur)), 2000);
    } catch {
      // Clipboard access denied/unavailable — no destructive fallback needed here.
    }
  };
  const weeklyMood = useMemo(() => timeline.slice(-7), [timeline]);
  const happyPct = useMemo(() => happyDaysPercent(timeline), [timeline]);

  if (loading && !profile) {
    return (
      <div className="animate-pulse">
        <div className="h-36 sm:h-44 rounded-2xl skeleton-pulse" />
        <div className="px-4 sm:px-6 -mt-12 relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="w-24 h-24 rounded-full shrink-0 skeleton-pulse" />
            <div className="flex-1 space-y-2 pb-1">
              <div className="h-5 w-40 rounded skeleton-pulse" />
              <div className="h-3 w-24 rounded skeleton-pulse" />
            </div>
            <div className="h-9 w-24 rounded-full shrink-0 skeleton-pulse" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full max-w-md rounded skeleton-pulse" />
            <div className="h-3 w-3/5 max-w-sm rounded skeleton-pulse" />
          </div>
          <div className="flex gap-5 mt-4">
            <div className="h-4 w-16 rounded skeleton-pulse" />
            <div className="h-4 w-16 rounded skeleton-pulse" />
            <div className="h-4 w-16 rounded skeleton-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile && profileError) {
    return (
      <div className="text-center py-20" style={{ color: C.text2 }}>
        <p>{t('profile.loadError')}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-full px-6 py-2.5 text-sm font-semibold"
          style={{ background: C.card, color: C.brown }}
        >
          {t('profile.retry')}
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20" style={{ color: C.text2 }}>
        {t('profile.notFound')}
      </div>
    );
  }

  const name = displayName(profile);
  const avatarSrc = profile.avatar ? mediaUrl(profile.avatar) : '';
  const coverSrc = profile.cover_photo ? mediaUrl(profile.cover_photo) : '';
  const moodMeta = currentMood ? emotionMeta(currentMood) : null;
  const coverBg = coverSrc
    ? `url(${coverSrc}) center/cover`
    : moodMeta
      ? `linear-gradient(135deg, ${moodMeta.color}CC 0%, ${moodMeta.color}66 55%, ${C.cream} 100%)`
      : C.cover;
  // The API now returns every achievement definition (locked ones included)
  // so the progress view on /achievements can show what's left to unlock —
  // this profile summary should only show ones actually earned.
  const earnedAchievements = (profile.achievements ?? []).filter((achievement) =>
    typeof achievement === 'string' ? true : achievement.completed === true,
  );

  return (
    <div
      className="overflow-hidden rounded-[30px] border pb-8"
      style={{
        background: C.cream,
        color: C.text,
        boxShadow: theme === 'light' ? '0 24px 60px rgba(33,27,61,0.10)' : '0 28px 70px rgba(5,4,18,0.42)',
        borderColor: C.line,
      }}
    >
      {/* Cover + edit */}
      <div
        className="relative h-40 sm:h-52 bg-cover bg-center"
        style={{ background: coverBg }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              theme === 'light'
                ? 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(243,240,252,0.18) 100%)'
                : 'linear-gradient(180deg, rgba(15,12,31,0.04) 0%, rgba(20,16,42,0.44) 100%)',
          }}
        />
        {isOwnProfile && (
          <div className="absolute right-3 top-3 flex flex-wrap items-center gap-2">
            <Link
              href="/analytics"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm"
              style={{ background: C.white, color: C.text, border: `1px solid ${C.line}` }}
            >
              <ChartBarIcon className="h-4 w-4" />
              {t('profile.viewAnalytics')}
            </Link>
            <Link
              href="/creator-hub"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm"
              style={{ background: C.white, color: C.text, border: `1px solid ${C.line}` }}
            >
              <SparklesIcon className="h-4 w-4" />
              {t('profile.creatorHub')}
            </Link>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm"
              style={{ background: C.white, color: C.text, border: `1px solid ${C.line}` }}
              aria-label={t('profile.editProfile')}
            >
              <PencilSquareIcon className="h-4 w-4" />
              {t('profile.editProfile')}
            </button>
          </div>
        )}
      </div>

      {/* Identity */}
      <div className="relative -mt-14 px-4 sm:px-6">
        <div
          className="rounded-[28px] border p-4 sm:p-5 backdrop-blur-xl"
          style={{
            background: theme === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(30,23,64,0.86)',
            borderColor: C.line,
            boxShadow: theme === 'light' ? '0 18px 44px rgba(33,27,61,0.10)' : '0 22px 54px rgba(5,4,18,0.36)',
          }}
        >
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <Image
              src={avatarSrc}
              alt={`${name} avatar`}
              width={96}
              height={96}
              className="w-24 h-24 rounded-full object-cover border-4 shrink-0"
              style={{ borderColor: C.cream, boxShadow: C.shadowSm }}
              unoptimized
            />
          ) : (
            <span
              className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0 border-4"
              style={{
                borderColor: C.cream,
                background: `linear-gradient(135deg, ${C.brown}, ${C.brownDk})`,
              }}
            >
              {initials(name)}
            </span>
          )}
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h1 className="flex items-center gap-1.5 text-xl sm:text-2xl font-bold">
                  {name}
                  {profile.badge_verified && (
                    <CheckBadgeIcon className="h-5 w-5 shrink-0 text-vault" aria-label={t('profile.verified')} />
                  )}
                </h1>
                <p className="text-sm" style={{ color: C.text2 }}>
                  @{profile.username}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {moodMeta && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: `${moodMeta.color}22`, color: moodMeta.color }}
                      title={t(moodMeta.labelKey)}
                    >
                      {moodMeta.emoji} {t('profile.feeling')} {t(moodMeta.labelKey)}
                    </span>
                  )}
                  {profile.spender_tier && profile.spender_tier !== 'none' && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        background: `${SPENDER_TIER_META[profile.spender_tier].color}22`,
                        color: SPENDER_TIER_META[profile.spender_tier].color,
                      }}
                    >
                      {SPENDER_TIER_META[profile.spender_tier].emoji}
                      {t(SPENDER_TIER_META[profile.spender_tier].labelKey)}
                    </span>
                  )}
                </div>
              </div>
              {!isOwnProfile && !profile.social?.is_blocked && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={toggleFollow}
                    className="rounded-full px-5 py-2 text-sm font-semibold text-white"
                    style={{
                      background: profile.is_following
                        ? C.card2
                        : `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`,
                      color: profile.is_following ? C.text : '#fff',
                      border: profile.is_following ? `1px solid ${C.line}` : 'none',
                    }}
                  >
                    {profile.is_following ? t('profile.following') : t('profile.follow')}
                  </button>
                  {!profile.social?.blocked_by_them && (
                    <>
                      <TipButton
                        recipientId={profile.id}
                        className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
                        buttonStyle={{ background: C.card2, color: C.text, border: `1px solid ${C.line}` }}
                      />
                      <SubscribeTiersButton
                        creatorId={profile.id}
                        className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
                        buttonStyle={{ background: C.card2, color: C.text, border: `1px solid ${C.line}` }}
                      />
                    </>
                  )}
                  <ProfileSocialMenu
                    userId={profile.id}
                    username={profile.username}
                    social={profile.social}
                    palette={{ card: C.card2, text: C.text, text2: C.text2, line: C.line }}
                    onUpdate={(social) => setProfile((p) => (p ? { ...p, social } : p))}
                    onBlocked={() => setProfile(null)}
                  />
                </div>
              )}
            </div>
            {followError && (
              <p className="mt-1 text-xs" style={{ color: '#E24B4A' }}>
                {followError}
              </p>
            )}
          </div>
        </div>

        {profile.bio && (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed" style={{ color: C.text }}>
            {profile.bio}
          </p>
        )}

        {(profile.location || '').trim() ? (
          <p className="mt-2 flex items-center gap-1 text-xs" style={{ color: C.text2 }}>
            <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
            {profile.location}
          </p>
        ) : null}

        {moodInsights.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: C.text2 }}>
              {t('profile.emotionalFingerprint')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {moodInsights.map((insight) => {
                const m = emotionMeta(insight.emotion);
                return (
                  <span
                    key={insight.emotion}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}33` }}
                  >
                    {m.emoji} {t(m.labelKey)} · {insight.pct}%
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2.5 text-sm">
          <span className="rounded-full px-3 py-2" style={{ background: C.card2, border: `1px solid ${C.line}` }}>
            <span className="font-bold" style={{ color: C.text }}>
              {formatCount(profile.posts_count)}
            </span>{' '}
            <span style={{ color: C.text2 }}>{t('profile.statPosts')}</span>
          </span>
          <button
            type="button"
            onClick={() => setTab('reels')}
            className="rounded-full px-3 py-2 text-left transition-opacity hover:opacity-80"
            style={{ background: C.card2, border: `1px solid ${C.line}` }}
          >
            <span className="font-bold" style={{ color: C.text }}>
              {formatCount(profile.reels_count ?? 0)}
            </span>{' '}
            <span style={{ color: C.text2 }}>{t('profile.statSignals')}</span>
          </button>
          <button
            type="button"
            onClick={() => setFollowModal('followers')}
            className="rounded-full px-3 py-2 text-left transition-opacity hover:opacity-80"
            style={{ background: C.card2, border: `1px solid ${C.line}` }}
          >
            <span className="font-bold" style={{ color: C.text }}>
              {formatCount(profile.followers_count)}
            </span>{' '}
            <span style={{ color: C.text2 }}>{t('profile.statFollowers')}</span>
          </button>
          <button
            type="button"
            onClick={() => setFollowModal('following')}
            className="rounded-full px-3 py-2 text-left transition-opacity hover:opacity-80"
            style={{ background: C.card2, border: `1px solid ${C.line}` }}
          >
            <span className="font-bold" style={{ color: C.text }}>
              {formatCount(profile.following_count)}
            </span>{' '}
            <span style={{ color: C.text2 }}>{t('profile.statFollowing')}</span>
          </button>
        </div>
        </div>
      </div>

      {/* Weekly mood */}
      <div
        className="mx-4 sm:mx-6 mt-6 rounded-2xl p-4"
        style={{ background: C.card2, border: `1px solid ${C.line}` }}
      >
        <h2 className="text-sm font-bold mb-3">{t('profile.weeklyMoodTitle')}</h2>
        <div className="grid grid-cols-7 gap-1.5 mb-4">
          {weeklyMood.map((day, i) => {
            const m = day.emotion ? emotionMeta(day.emotion) : null;
            return (
              <div key={day.day} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium" style={{ color: C.text2 }}>
                  {WEEK_LABEL_KEYS[i] ? t(WEEK_LABEL_KEYS[i]) : `D${day.day}`}
                </span>
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-lg"
                  style={{
                    background: m ? `${m.color}22` : C.white,
                    border: `1px solid ${m ? `${m.color}55` : C.line}`,
                  }}
                  title={m ? t(m.labelKey) : t('profile.noMoodLogged')}
                >
                  {m ? m.emoji : '·'}
                </div>
              </div>
            );
          })}
        </div>
        <div
          className="rounded-xl p-3"
          style={{ background: C.white, border: `1px solid ${C.line}` }}
        >
          <div className="flex items-center justify-between text-sm mb-2">
            <span style={{ color: C.text }}>
              <span className="font-bold">{happyPct}%</span> {t('profile.happyDaysThisMonth')}
            </span>
            <span className="text-lg">✨</span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: C.brownDk }}
              initial={{ width: 0 }}
              animate={{ width: `${happyPct}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </div>
      </div>

      {futureMemory && (
        <div
          className="mx-4 sm:mx-6 mt-6 rounded-2xl p-4"
          style={{ background: `linear-gradient(135deg, ${C.card}, ${C.card2})`, border: `1px solid ${C.line}` }}
        >
          <p className="flex items-center gap-1.5 text-sm font-bold mb-2">
            🔮 {t('profile.futureMemoryTitle')}
          </p>
          <p className="text-sm italic leading-relaxed" style={{ color: C.text }}>
            &ldquo;{futureMemory.text}&rdquo;
          </p>
          {futureMemory.tag && (
            <span
              className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full"
              style={{ background: C.white, color: C.text2 }}
            >
              #{futureMemory.tag}
            </span>
          )}
        </div>
      )}

      {(isOwnProfile || experiences.length > 0) && (
        <section
          className="mx-4 sm:mx-6 mt-6 rounded-2xl p-4"
          style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <BriefcaseIcon className="h-5 w-5" style={{ color: C.brown }} />
                {t('profile.experienceTitle')}
              </h2>
              <p className="mt-1 text-xs" style={{ color: C.text2 }}>
                {isOwnProfile ? t('profile.experienceSubtitleOwn') : t('profile.experienceSubtitleOther', { name })}
              </p>
            </div>
            {isOwnProfile && editingExperienceId ? (
              <button type="button" onClick={resetExperienceForm} className="text-xs font-semibold" style={{ color: C.brown }}>
                {t('profile.cancelEdit')}
              </button>
            ) : null}
          </div>

          {isOwnProfile ? (
            <>
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  value={experienceForm.title}
                  onChange={(e) => setExperienceForm((form) => ({ ...form, title: e.target.value }))}
                  placeholder={t('profile.experienceFieldTitle')}
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ background: C.card2, borderColor: C.line, color: C.text }}
                />
                <input
                  value={experienceForm.organization}
                  onChange={(e) => setExperienceForm((form) => ({ ...form, organization: e.target.value }))}
                  placeholder={t('profile.experienceFieldOrganization')}
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{ background: C.card2, borderColor: C.line, color: C.text }}
                />
                <label className="text-xs font-semibold" style={{ color: C.text2 }}>
                  {t('profile.experienceFieldStartDate')}
                  <input
                    type="date"
                    value={experienceForm.start_date}
                    onChange={(e) => setExperienceForm((form) => ({ ...form, start_date: e.target.value }))}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    style={{ background: C.card2, borderColor: C.line, color: C.text }}
                  />
                </label>
                <label className="text-xs font-semibold" style={{ color: C.text2 }}>
                  {t('profile.experienceFieldEndDate')}
                  <input
                    type="date"
                    value={experienceForm.end_date}
                    disabled={experienceForm.is_current}
                    onChange={(e) => setExperienceForm((form) => ({ ...form, end_date: e.target.value }))}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm disabled:opacity-50"
                    style={{ background: C.card2, borderColor: C.line, color: C.text }}
                  />
                </label>
              </div>
              <textarea
                value={experienceForm.description}
                onChange={(e) => setExperienceForm((form) => ({ ...form, description: e.target.value }))}
                placeholder={t('profile.experienceFieldDescription')}
                rows={2}
                className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                style={{ background: C.card2, borderColor: C.line, color: C.text }}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm" style={{ color: C.text2 }}>
                  <input
                    type="checkbox"
                    checked={experienceForm.is_current}
                    onChange={(e) => setExperienceForm((form) => ({ ...form, is_current: e.target.checked, end_date: e.target.checked ? '' : form.end_date }))}
                  />
                  {t('profile.experienceCurrentCheckbox')}
                </label>
                <button
                  type="button"
                  onClick={() => void saveExperience()}
                  disabled={experienceBusy || !experienceForm.title.trim() || !experienceForm.organization.trim() || !experienceForm.start_date}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}
                >
                  <PlusIcon className="h-4 w-4" />
                  {editingExperienceId ? t('profile.experienceSaveChanges') : t('profile.experienceAdd')}
                </button>
              </div>
              {experienceError ? <p className="mt-2 text-xs text-red-500">{experienceError}</p> : null}
            </>
          ) : null}

          <div className="mt-5 space-y-3">
            {experiences.length === 0 ? (
              <p className="text-sm" style={{ color: C.text2 }}>{t('profile.experienceEmpty')}</p>
            ) : (
              experiences.map((experience) => (
                <div key={experience.id} className="rounded-xl border p-3" style={{ background: C.card2, borderColor: C.line }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{experience.title}</p>
                      <p className="text-sm" style={{ color: C.text2 }}>{experience.organization}</p>
                      <p className="mt-1 text-xs" style={{ color: C.text2 }}>
                        {experience.start_date}
                        {' - '}
                        {experience.is_current ? t('profile.experiencePresent') : experience.end_date || t('profile.experiencePresent')}
                      </p>
                    </div>
                    {isOwnProfile ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEditExperience(experience)}
                        className="rounded-lg p-1.5"
                        style={{ background: C.white, color: C.brown }}
                        aria-label={t('profile.experienceEditLabel')}
                      >
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteExperience(experience.id)}
                        className="rounded-lg p-1.5 text-red-500"
                        style={{ background: C.white }}
                        aria-label={t('profile.experienceDeleteLabel')}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                    ) : null}
                  </div>
                  {experience.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm" style={{ color: C.text }}>{experience.description}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      )}

      <div className="mx-4 sm:mx-6 mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div
          className="rounded-2xl p-4"
          style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
        >
          <div className="flex items-center gap-2 mb-3">
            <SparklesIcon className="h-5 w-5" style={{ color: C.brown }} />
            <h2 className="text-sm font-bold">{t('profile.achievementsTitle')}</h2>
          </div>
          <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-3" style={{ background: C.card2 }}>
            <span className="text-sm" style={{ color: C.text2 }}>{t('profile.pointsBalance')}</span>
            <span className="text-lg font-bold" style={{ color: C.brown }}>{formatCount(profile.points ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-3" style={{ background: C.card2 }}>
            <span className="text-sm" style={{ color: C.text2 }}>{t('profile.signalStrength')}</span>
            <span className="text-lg font-bold" style={{ color: C.brown }}>{formatCount(profile.karma ?? 0)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {earnedAchievements.length === 0 ? (
              <p className="text-sm" style={{ color: C.text2 }}>{t('profile.achievementsEmpty')}</p>
            ) : (
              earnedAchievements.map((achievement) => {
                const label = typeof achievement === 'string' ? achievement : achievement.title || '';
                const icon = typeof achievement === 'string' ? null : achievement.icon;
                const key = typeof achievement === 'string' ? achievement : achievement.id ?? label;
                return (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{ background: C.card2, color: C.brown, border: `1px solid ${C.line}` }}
                  >
                    {icon || '✦'} {label}
                  </span>
                );
              })
            )}
          </div>
        </div>

        <aside
          className="rounded-2xl p-4"
          style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
        >
          <h2 className="text-sm font-bold mb-3">{t('profile.suggestedUsers')}</h2>
          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <p className="text-sm" style={{ color: C.text2 }}>{t('profile.suggestionsEmpty')}</p>
            ) : (
              suggestions.map((suggested) => (
                <Link key={suggested.id} href={`/profile/${suggested.id}`} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:opacity-90" style={{ background: C.card2 }}>
                  {suggested.avatar ? (
                    <Image src={mediaUrl(suggested.avatar)} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" unoptimized />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${C.brown}, ${C.brownDk})` }}>
                      {initials(displayName(suggested))}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: C.text }}>{displayName(suggested)}</p>
                    <p className="truncate text-xs" style={{ color: C.text2 }}>@{suggested.username}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </aside>
      </div>

      <ProfileStoryConstellations userId={userId} isOwner={isOwnProfile} />

      {/* Tabs */}
      <div
        className="mx-4 sm:mx-6 mt-6 flex rounded-xl p-1 gap-0.5 overflow-x-auto"
        style={{ background: C.tabBg }}
      >
        {(
          [
            { key: 'posts', labelKey: 'profile.tabPosts' },
            { key: 'reels', labelKey: 'profile.tabSignals', icon: true as const },
            { key: 'ideas', labelKey: 'profile.tabIdeas' },
            { key: 'challenges', labelKey: 'profile.tabChallenges' },
            { key: 'stories', labelKey: 'profile.tabStories' },
            { key: 'bottles', labelKey: 'profile.tabBottles' },
          ] as const
        ).map((tabDef) => (
          <button
            key={tabDef.key}
            type="button"
            onClick={() => setTab(tabDef.key)}
            className="flex-1 min-w-[4.5rem] py-2.5 text-sm font-semibold rounded-lg relative whitespace-nowrap transition-colors"
            style={{
              color: tab === tabDef.key ? C.brown : C.text2,
              background: tab === tabDef.key ? C.white : 'transparent',
            }}
          >
            {'icon' in tabDef && tabDef.icon ? (
              <span className="inline-flex items-center justify-center gap-1">
                <ReelsIcon size={14} active={tab === tabDef.key} />
                {t(tabDef.labelKey)}
              </span>
            ) : (
              t(tabDef.labelKey)
            )}
            {tab === tabDef.key && (
              <motion.div
                layoutId="profileTab"
                className="absolute bottom-0 left-2 right-2 h-0.5 rounded"
                style={{ background: C.brown }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 sm:px-6 mt-5">
        {tab === 'posts' && (
          <>
            {mappedPosts.length === 0 ? (
              <p className="text-center py-10 text-sm" style={{ color: C.text2 }}>
                {t('profile.noPostsYet')}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:hidden">
                  {mappedPosts.map((post) => {
                    const thumb = postThumbnail(post);
                    const likes = reactionTotal(post.reaction_counts);
                    return (
                      <Link
                        key={post.id}
                        href={`/post/${post.id}`}
                        className="rounded-xl overflow-hidden block"
                        style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
                      >
                        <div
                          className="aspect-square bg-cover bg-center relative"
                          style={{
                            background: thumb
                              ? `url(${thumb}) center/cover`
                              : `linear-gradient(135deg, ${C.card}, ${C.card2})`,
                          }}
                        >
                          {post.is_profile_pinned && (
                            <span
                              className="absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                              style={{ background: 'rgba(0,0,0,0.55)' }}
                            >
                              {t('signal.pinned')}
                            </span>
                          )}
                          <div
                            className="absolute bottom-0 left-0 right-0 px-2 py-1.5 flex gap-3 text-[10px] text-white"
                            style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.65))' }}
                          >
                            <span className="flex items-center gap-0.5">
                              <HeartIcon className="h-3 w-3" /> {formatCount(likes)}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <ChatBubbleLeftRightIcon className="h-3 w-3" />{' '}
                              {post.stats?.comments ?? 0}
                            </span>
                          </div>
                        </div>
                        <p className="p-2 text-xs font-semibold truncate" style={{ color: C.text }}>
                          {postTitle(post.text, t('profile.untitledPost'))}
                        </p>
                      </Link>
                    );
                  })}
                </div>
                <div className="hidden sm:grid grid-cols-3 gap-4">
                  {mappedPosts.map((post, idx) => {
                    const thumb = postThumbnail(post);
                    const likes = reactionTotal(post.reaction_counts);
                    return (
                      <motion.div
                        key={post.id || idx}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group relative rounded-xl overflow-hidden"
                        style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
                      >
                        <Link href={`/post/${post.id}`} className="block">
                          <div
                            className="aspect-square bg-cover bg-center relative"
                            style={{
                              background: thumb
                                ? `url(${thumb}) center/cover`
                                : `linear-gradient(135deg, ${C.card}, ${C.card2})`,
                            }}
                          >
                            {post.is_profile_pinned && (
                              <span
                                className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                                style={{ background: 'rgba(0,0,0,0.55)' }}
                              >
                                {t('signal.pinned')}
                              </span>
                            )}
                            <div
                              className="absolute bottom-0 left-0 right-0 px-3 py-2 flex gap-4 text-xs text-white"
                              style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.65))' }}
                            >
                              <span className="flex items-center gap-1">
                                <HeartIcon className="h-3.5 w-3.5" /> {formatCount(likes)}
                              </span>
                              <span className="flex items-center gap-1">
                                <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />{' '}
                                {post.stats?.comments ?? 0}
                              </span>
                            </div>
                          </div>
                          <p className="p-2.5 text-sm font-semibold truncate" style={{ color: C.text }}>
                            {postTitle(post.text, t('profile.untitledPost'))}
                          </p>
                        </Link>
                        <button
                          type="button"
                          aria-label={t('feed.share')}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (post.id) void handleShareCard(post.id);
                          }}
                          className="absolute top-2 right-2 rounded-full p-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                          style={{ background: 'rgba(0,0,0,0.55)' }}
                        >
                          <ArrowUpOnSquareIcon className="h-4 w-4 text-white" />
                        </button>
                        {copiedPostId === post.id && (
                          <span
                            className="absolute top-2 right-11 rounded-full px-2 py-1 text-[10px] font-semibold text-white"
                            style={{ background: 'rgba(0,0,0,0.65)' }}
                          >
                            {t('feed.copied')}
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'reels' && <ProfileReelsGrid userId={userId} palette={C} />}

        {tab === 'ideas' && (
          <ProfileIdeasGrid userId={userId} palette={{ ...C, brownDk: C.brownDk }} />
        )}

        {isOwnProfile && tab === 'reels' && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-bold" style={{ color: C.text }}>{t('profile.savedSignals')}</h3>
            <ProfileReelsGrid userId={userId} palette={C} mode="saved" />
          </div>
        )}

        {tab === 'challenges' && (
          <div className="grid sm:grid-cols-2 gap-3">
            {challenges.length === 0 ? (
              <p className="col-span-full text-center py-10 text-sm" style={{ color: C.text2 }}>
                {t('profile.noChallengeEntries')}
              </p>
            ) : (
              challenges.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/lab?challenge=${entry.challenge?.id ?? entry.id}`}
                  className="rounded-xl p-4 block"
                  style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
                >
                  <p className="font-semibold text-sm" style={{ color: C.text }}>
                    {entry.challenge?.title ?? t('profile.challengeFallbackTitle')}
                  </p>
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: C.text2 }}>
                    {entry.content}
                  </p>
                  {entry.is_approved && (
                    <span
                      className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: `${C.brown}22`, color: C.brown }}
                    >
                      {t('profile.approvedBadge')}
                    </span>
                  )}
                </Link>
              ))
            )}
          </div>
        )}

        {tab === 'stories' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stories.length === 0 ? (
              <p className="col-span-full text-center py-10 text-sm" style={{ color: C.text2 }}>
                {t('profile.noStoriesInForge')}
              </p>
            ) : (
              stories.map((story) => (
                <Link
                  key={story.id}
                  href={`/forge?story=${story.id}`}
                  className="rounded-xl overflow-hidden block"
                  style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
                >
                  <div
                    className="h-28 bg-cover bg-center"
                    style={{
                      background: story.cover_url
                        ? `url(${story.cover_url}) center/cover`
                        : `linear-gradient(135deg, ${C.card}, ${C.card2})`,
                    }}
                  />
                  <div className="p-3">
                    <p className="font-semibold text-sm truncate" style={{ color: C.text }}>
                      {story.title}
                    </p>
                    <p className="text-xs mt-1" style={{ color: C.text2 }}>
                      {t('profile.storyParts', { count: String(story.segment_count), max: String(story.max_segments), genre: story.genre || '' })}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {tab === 'bottles' && (
          <div className="space-y-3">
            {bottles.length === 0 ? (
              <p className="text-center py-10 text-sm" style={{ color: C.text2 }}>
                {t('profile.noActiveBottles')}
              </p>
            ) : (
              bottles.map((b) => {
                const m = emotionMeta(b.emotion_type);
                return (
                  <div
                    key={b.id}
                    className="rounded-xl p-4"
                    style={{
                      background: C.white,
                      border: `1px solid ${m.color}44`,
                      boxShadow: C.shadowSm,
                    }}
                  >
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-2"
                      style={{ background: `${m.color}22`, color: m.color }}
                    >
                      {m.emoji} {t(m.labelKey)}
                    </span>
                    <p className="text-sm leading-relaxed line-clamp-3" style={{ color: C.text }}>
                      {b.message}
                    </p>
                    {b.expires_at && (
                      <p className="text-[11px] mt-2" style={{ color: C.text2 }}>
                        {t('bottles.vanishesIn', { time: formatBottleTimeLeft(b.expires_at) })}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {editOpen && profile && (
          <EditProfileModal
            profile={profile}
            colors={{ ...C, brownDk: C.brownDk }}
            onClose={() => setEditOpen(false)}
            onSaved={(updated) => setProfile({ ...profile, ...updated })}
          />
        )}
        {followModal && (
          <FollowListModal
            userId={userId}
            mode={followModal}
            title={followModal === 'followers' ? t('profile.followersTitle') : t('profile.followingTitle')}
            colors={C}
            onClose={() => setFollowModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
