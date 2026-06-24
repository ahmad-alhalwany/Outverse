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
  HeartIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
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
import PostCard from '@/components/PostCard';
import ProfileReelsGrid from '@/components/profile/ProfileReelsGrid';
import ReelsIcon from '@/components/icons/ReelsIcon';

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
    cover: 'linear-gradient(135deg, #f8c4a8 0%, #e8b4c8 35%, #b8d4f0 100%)',
    tabBg: '#EDE4DC',
    shadowSm: '0 2px 12px rgba(160,86,59,0.08)',
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
    cover: 'linear-gradient(135deg, #2d1b4a 0%, #23234a 40%, #1a1a2e 100%)',
    tabBg: '#1e1e38',
    shadowSm: '0 2px 12px rgba(106,0,255,0.12)',
  },
};

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type TabKey = 'posts' | 'reels' | 'challenges' | 'stories' | 'bottles';

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
  points?: number;
  achievements?: string[];
  status?: string;
}

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

function postTitle(text: string) {
  const line = (text || '').trim().split('\n')[0];
  if (!line) return 'Untitled post';
  return line.length > 48 ? `${line.slice(0, 48)}…` : line;
}

function reactionTotal(counts?: Record<string, number>) {
  if (!counts) return 0;
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

export default function ProfileView({ userId }: ProfileViewProps) {
  const { theme } = useTheme();
  const C = PALETTES[theme];
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<ReturnType<typeof mapPost>[]>([]);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [stories, setStories] = useState<ForgeStory[]>([]);
  const [challenges, setChallenges] = useState<ChallengeEntry[]>([]);
  const [bottles, setBottles] = useState<BottleEntry[]>([]);
  const [tab, setTab] = useState<TabKey>('posts');
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null);

  const authUser = useAuthUser();
  const isOwnProfile = authUser ? String(authUser.id) === String(userId) : false;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [profileRes, postsRes, moodRes, storiesRes, challRes, bottlesRes, suggestionsRes] =
        await Promise.all([
          apiFetch(`users/${userId}/`),
          apiFetch(`posts/?author=${userId}`),
          apiFetch(`bottles/dashboard/?user=${userId}`),
          apiFetch(`forge/stories/?owner=${userId}`),
          apiFetch(`challenges/user_entries/?user=${userId}`),
          isOwnProfile
            ? apiFetch('bottles/my_bottles/?active=1')
            : Promise.resolve(new Response(JSON.stringify([]), { status: 200 })),
          apiFetch(`users/suggestions/?exclude=${userId}`),
        ]);
      if (profileRes.ok) setProfile(await profileRes.json());
      if (postsRes.ok) {
        const data = await postsRes.json();
        setPosts(Array.isArray(data) ? data.map(mapPost) : []);
      }
      if (moodRes.ok) {
        const mood = await moodRes.json();
        setTimeline(Array.isArray(mood.timeline) ? mood.timeline : []);
      }
      if (storiesRes.ok) setStories(await storiesRes.json());
      if (challRes.ok) setChallenges(await challRes.json());
      if (bottlesRes.ok) setBottles(await bottlesRes.json());
      if (suggestionsRes.ok) setSuggestions(await suggestionsRes.json());
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, [userId, isOwnProfile]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleFollow = async () => {
    if (!profile) return;
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
      }
    } catch {
      /* ignore */
    }
  };

  const mappedPosts = useMemo(() => posts, [posts]);
  const weeklyMood = useMemo(() => timeline.slice(-7), [timeline]);
  const happyPct = useMemo(() => happyDaysPercent(timeline), [timeline]);

  if (loading && !profile) {
    return (
      <div className="text-center py-20" style={{ color: C.text2 }}>
        Loading profile…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20" style={{ color: C.text2 }}>
        User not found.
      </div>
    );
  }

  const name = displayName(profile);
  const avatarSrc = profile.avatar ? mediaUrl(profile.avatar) : '';
  const coverSrc = profile.cover_photo ? mediaUrl(profile.cover_photo) : '';

  return (
    <div
      className="rounded-2xl overflow-hidden pb-8"
      style={{ background: C.cream, color: C.text, boxShadow: C.shadowSm }}
    >
      {/* Cover + edit */}
      <div
        className="relative h-36 sm:h-44 bg-cover bg-center"
        style={{ background: coverSrc ? `url(${coverSrc}) center/cover` : C.cover }}
      >
        {isOwnProfile && (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm"
            style={{ background: C.white, color: C.text, border: `1px solid ${C.line}` }}
            aria-label="Edit profile"
          >
            <PencilSquareIcon className="h-4 w-4" />
            Edit profile
          </button>
        )}
      </div>

      {/* Identity */}
      <div className="px-4 sm:px-6 -mt-12 relative">
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
                <h1 className="text-xl sm:text-2xl font-bold">{name}</h1>
                <p className="text-sm" style={{ color: C.text2 }}>
                  @{profile.username}
                </p>
              </div>
              {!isOwnProfile && (
                <button
                  type="button"
                  onClick={toggleFollow}
                  className="rounded-full px-5 py-2 text-sm font-semibold text-white shrink-0"
                  style={{
                    background: profile.is_following
                      ? C.card2
                      : `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`,
                    color: profile.is_following ? C.text : '#fff',
                    border: profile.is_following ? `1px solid ${C.line}` : 'none',
                  }}
                >
                  {profile.is_following ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          </div>
        </div>

        {profile.bio && (
          <p className="mt-3 text-sm leading-relaxed" style={{ color: C.text }}>
            {profile.bio}
          </p>
        )}

        {(profile.location || '').trim() ? (
          <p className="mt-2 flex items-center gap-1 text-xs" style={{ color: C.text2 }}>
            <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
            {profile.location}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-5 mt-4 text-sm">
          <span>
            <span className="font-bold" style={{ color: C.text }}>
              {formatCount(profile.posts_count)}
            </span>{' '}
            <span style={{ color: C.text2 }}>posts</span>
          </span>
          <button
            type="button"
            onClick={() => setTab('reels')}
            className="hover:opacity-80 text-left"
          >
            <span className="font-bold" style={{ color: C.text }}>
              {formatCount(profile.reels_count ?? 0)}
            </span>{' '}
            <span style={{ color: C.text2 }}>signals</span>
          </button>
          <button
            type="button"
            onClick={() => setFollowModal('followers')}
            className="hover:opacity-80 text-left"
          >
            <span className="font-bold" style={{ color: C.text }}>
              {formatCount(profile.followers_count)}
            </span>{' '}
            <span style={{ color: C.text2 }}>followers</span>
          </button>
          <button
            type="button"
            onClick={() => setFollowModal('following')}
            className="hover:opacity-80 text-left"
          >
            <span className="font-bold" style={{ color: C.text }}>
              {formatCount(profile.following_count)}
            </span>{' '}
            <span style={{ color: C.text2 }}>following</span>
          </button>
        </div>
      </div>

      {/* Weekly mood */}
      <div
        className="mx-4 sm:mx-6 mt-6 rounded-2xl p-4"
        style={{ background: C.card2, border: `1px solid ${C.line}` }}
      >
        <h2 className="text-sm font-bold mb-3">Weekly mood</h2>
        <div className="grid grid-cols-7 gap-1.5 mb-4">
          {weeklyMood.map((day, i) => {
            const m = day.emotion ? emotionMeta(day.emotion) : null;
            return (
              <div key={day.day} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium" style={{ color: C.text2 }}>
                  {WEEK_LABELS[i] ?? `D${day.day}`}
                </span>
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-lg"
                  style={{
                    background: m ? `${m.color}22` : C.white,
                    border: `1px solid ${m ? `${m.color}55` : C.line}`,
                  }}
                  title={m?.label ?? 'No mood logged'}
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
              <span className="font-bold">{happyPct}%</span> Happy Days This Month
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

      <div className="mx-4 sm:mx-6 mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div
          className="rounded-2xl p-4"
          style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
        >
          <div className="flex items-center gap-2 mb-3">
            <SparklesIcon className="h-5 w-5" style={{ color: C.brown }} />
            <h2 className="text-sm font-bold">Achievements</h2>
          </div>
          <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-3" style={{ background: C.card2 }}>
            <span className="text-sm" style={{ color: C.text2 }}>Points balance</span>
            <span className="text-lg font-bold" style={{ color: C.brown }}>{formatCount(profile.points ?? 0)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(profile.achievements ?? []).length === 0 ? (
              <p className="text-sm" style={{ color: C.text2 }}>No achievements unlocked yet.</p>
            ) : (
              (profile.achievements ?? []).map((achievement) => (
                <span
                  key={achievement}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: C.card2, color: C.brown, border: `1px solid ${C.line}` }}
                >
                  ✦ {achievement}
                </span>
              ))
            )}
          </div>
        </div>

        <aside
          className="rounded-2xl p-4"
          style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
        >
          <h2 className="text-sm font-bold mb-3">Suggested Users</h2>
          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <p className="text-sm" style={{ color: C.text2 }}>No suggestions right now.</p>
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

      {/* Tabs */}
      <div
        className="mx-4 sm:mx-6 mt-6 flex rounded-xl p-1 gap-0.5 overflow-x-auto"
        style={{ background: C.tabBg }}
      >
        {(
          [
            { key: 'posts', label: 'Posts' },
            { key: 'reels', label: 'Signals', icon: true as const },
            { key: 'challenges', label: 'Challenges' },
            { key: 'stories', label: 'Stories' },
            { key: 'bottles', label: 'Bottles' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="flex-1 min-w-[4.5rem] py-2.5 text-sm font-semibold rounded-lg relative whitespace-nowrap transition-colors"
            style={{
              color: tab === t.key ? C.brown : C.text2,
              background: tab === t.key ? C.white : 'transparent',
            }}
          >
            {'icon' in t && t.icon ? (
              <span className="inline-flex items-center justify-center gap-1">
                <ReelsIcon size={14} active={tab === t.key} />
                {t.label}
              </span>
            ) : (
              t.label
            )}
            {tab === t.key && (
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
                No posts yet.
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
                          {postTitle(post.text)}
                        </p>
                      </Link>
                    );
                  })}
                </div>
                <div className="hidden sm:block space-y-6">
                  {mappedPosts.map((post, idx) => (
                    <motion.div
                      key={post.id || idx}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <PostCard {...post} onDeleted={load} onUpdated={load} />
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'reels' && <ProfileReelsGrid userId={userId} palette={C} />}

        {isOwnProfile && tab === 'reels' && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-bold" style={{ color: C.text }}>Saved Signals</h3>
            <ProfileReelsGrid userId={userId} palette={C} mode="saved" />
          </div>
        )}

        {tab === 'challenges' && (
          <div className="grid sm:grid-cols-2 gap-3">
            {challenges.length === 0 ? (
              <p className="col-span-full text-center py-10 text-sm" style={{ color: C.text2 }}>
                No challenge entries yet.
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
                    {entry.challenge?.title ?? 'Challenge'}
                  </p>
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: C.text2 }}>
                    {entry.content}
                  </p>
                  {entry.is_approved && (
                    <span
                      className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: `${C.brown}22`, color: C.brown }}
                    >
                      Approved
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
                No stories in the forge yet.
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
                      {story.segment_count}/{story.max_segments} parts · {story.genre}
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
                No active drifting bottles — throw one from the emotion map.
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
                      {m.emoji} {m.label}
                    </span>
                    <p className="text-sm leading-relaxed line-clamp-3" style={{ color: C.text }}>
                      {b.message}
                    </p>
                    {b.expires_at && (
                      <p className="text-[11px] mt-2" style={{ color: C.text2 }}>
                        ⏳ Vanishes in {formatBottleTimeLeft(b.expires_at)}
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
            title={followModal === 'followers' ? 'Followers' : 'Following'}
            colors={C}
            onClose={() => setFollowModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
