'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import EditProfileModal from '@/components/profile/EditProfileModal';
import FollowListModal from '@/components/profile/FollowListModal';
import { formatBottleTimeLeft } from '@/utils/bottleTime';
import {
  MapPinIcon,
  PencilSquareIcon,
  HeartIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '@/components/ThemeProvider';
import { apiUrl, mediaUrl } from '@/lib/api';
import { getCurrentUserId, getUser } from '@/lib/auth';
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
  posts_count: number;
  reels_count?: number;
  followers_count: number;
  following_count: number;
  is_following: boolean;
}

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
  const [posts, setPosts] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [bottles, setBottles] = useState<any[]>([]);
  const [tab, setTab] = useState<TabKey>('posts');
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null);

  const isOwnProfile = String(getCurrentUserId()) === String(userId);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [profileRes, postsRes, moodRes, storiesRes, challRes, bottlesRes] =
        await Promise.all([
          apiFetch(`users/${userId}/`),
          apiFetch(`posts/?author=${userId}`),
          apiFetch(`bottles/dashboard/?user=${userId}`),
          fetch(apiUrl(`forge/stories/?owner=${userId}`)),
          apiFetch(`challenges/user_entries/?user=${userId}`),
          isOwnProfile
            ? apiFetch('bottles/my_bottles/?active=1')
            : Promise.resolve(new Response(JSON.stringify([]), { status: 200 })),
        ]);
      if (profileRes.ok) setProfile(await profileRes.json());
      if (postsRes.ok) {
        const data = await postsRes.json();
        setPosts(Array.isArray(data) ? data : []);
      }
      if (moodRes.ok) {
        const mood = await moodRes.json();
        setTimeline(Array.isArray(mood.timeline) ? mood.timeline : []);
      }
      if (storiesRes.ok) setStories(await storiesRes.json());
      if (challRes.ok) setChallenges(await challRes.json());
      if (bottlesRes.ok) setBottles(await bottlesRes.json());
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, [userId]);

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

  const mappedPosts = useMemo(() => posts.map((p) => mapPost(p)), [posts]);
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

  return (
    <div
      className="rounded-2xl overflow-hidden pb-8"
      style={{ background: C.cream, color: C.text, boxShadow: C.shadowSm }}
    >
      {/* Cover + edit */}
      <div className="relative h-36 sm:h-44" style={{ background: C.cover }}>
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
            <img
              src={avatarSrc}
              alt={name}
              className="w-24 h-24 rounded-full object-cover border-4 shrink-0"
              style={{ borderColor: C.cream, boxShadow: C.shadowSm }}
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

        {tab === 'challenges' && (
          <div className="grid sm:grid-cols-2 gap-3">
            {challenges.length === 0 ? (
              <p className="col-span-full text-center py-10 text-sm" style={{ color: C.text2 }}>
                No challenge entries yet.
              </p>
            ) : (
              challenges.map((entry: any) => (
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
              stories.map((story: any) => (
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
              bottles.map((b: any) => {
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
