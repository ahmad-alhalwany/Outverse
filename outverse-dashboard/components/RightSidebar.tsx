'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { getUser } from '@/lib/auth';
import { apiFetch, apiFetchJson } from '@/lib/api';
import EmotionMap from './EmotionMap';

interface TrendingPost {
  id: number;
  text: string;
  likes_count: number;
  user: { username: string };
  tags?: string[];
}

interface Creator {
  id: number;
  username: string;
  avatar: string | null;
  bio: string | null;
  posts_count: number;
  followers_count: number;
  is_following: boolean;
}

function snippet(text: string, max = 42) {
  if (!text) return 'Untitled';
  return text.length > max ? `${text.slice(0, max).trim()}…` : text;
}

function initials(name: string) {
  return name ? name.slice(0, 2).toUpperCase() : '??';
}

export default function RightSidebar() {
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [followError, setFollowError] = useState('');

  useEffect(() => {
    let active = true;

    apiFetch('posts/trending/')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active) setTrendingPosts(Array.isArray(data) ? data : []);
      })
      .catch(() => {});

    const me = getUser()?.id;
    apiFetch(me ? `users/suggestions/?exclude=${me}` : 'users/suggestions/')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active) setCreators(Array.isArray(data) ? data : []);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const toggleFollow = async (creator: Creator) => {
    setFollowError('');
    try {
      const res = await apiFetchJson('users/follow/', {
        method: 'POST',
        json: { following_id: creator.id },
      });
      if (res.ok) {
        const data = await res.json();
        setCreators((prev) =>
          prev.map((current) =>
            current.id === creator.id
              ? {
                  ...current,
                  is_following: data.is_following,
                  followers_count: data.followers_count,
                }
              : current,
          ),
        );
      } else {
        setFollowError('Could not update follow status.');
        window.setTimeout(() => setFollowError(''), 3000);
      }
    } catch {
      setFollowError('Could not update follow status.');
      window.setTimeout(() => setFollowError(''), 3000);
    }
  };

  const trendingTopics = useMemo(() => {
    const counts: Record<string, number> = {};
    trendingPosts.forEach((post) => {
      (post.tags || []).forEach((tag) => {
        const key = tag.trim();
        if (key) counts[key] = (counts[key] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([topic, count]) => ({ topic, count }));
  }, [trendingPosts]);

  return (
    <aside className="home-right-rail sticky top-24 hidden h-fit w-[320px] shrink-0 px-4 xl:block">
      <div className="home-rail-card p-5 mb-5">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">Global Emotion Map</h3>
        <EmotionMap />
        <Link
          href="/bottles"
          className="mt-3 block text-center text-[11px] font-semibold text-vault hover:underline"
        >
          Open full vault →
        </Link>
      </div>

      <div className="home-rail-card p-5 mb-5">
        <h3 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
          <span>Active Friends</span>
          <span className="text-bazaar text-base">✨</span>
        </h3>
        {creators.length === 0 ? (
          <p className="text-xs text-text-secondary">No suggestions yet.</p>
        ) : (
          <ul className="text-xs text-text space-y-3">
            {creators.map((creator) => (
              <li key={creator.id} className="flex items-center justify-between">
                <Link href={`/profile/${creator.id}`} className="flex items-center gap-2 min-w-0 group">
                  {creator.avatar ? (
                    <Image
                      src={creator.avatar}
                      alt={creator.username}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full border-2 border-vault/40 object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-vault to-bazaar text-white flex items-center justify-center text-[10px] font-bold">
                      {initials(creator.username)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block font-medium truncate group-hover:underline">{creator.username}</span>
                    <span className="block text-text-secondary text-[10px]">
                      {creator.is_following ? 'following' : `${creator.followers_count} followers`}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => toggleFollow(creator)}
                  className={`rounded-full px-2.5 h-6 flex items-center justify-center text-[11px] font-semibold transition ${
                    creator.is_following
                      ? 'bg-vault/20 text-vault hover:bg-vault/30'
                      : 'bg-bazaar/15 text-bazaar hover:bg-bazaar/30'
                  }`}
                  title={creator.is_following ? `Unfollow ${creator.username}` : `Follow ${creator.username}`}
                >
                  {creator.is_following ? 'Following' : 'Follow'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {followError && (
          <p className="mt-2 text-[10px]" style={{ color: '#E24B4A' }}>
            {followError}
          </p>
        )}
      </div>

      <div className="home-rail-card p-5 mb-5">
        <h3 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
          <span>Trending Posts</span>
          <span className="text-yellow-400 text-base">🌠</span>
        </h3>
        {trendingPosts.length === 0 ? (
          <p className="text-xs text-text-secondary">Nothing trending yet.</p>
        ) : (
          <ul className="text-xs text-text space-y-2">
            {trendingPosts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/post/${post.id}`}
                  className="flex items-center justify-between gap-2 hover:opacity-80"
                >
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-gradient-to-tr from-vault to-bazaar shrink-0" />
                    <span className="truncate">{snippet(post.text)}</span>
                  </span>
                  <span className="flex items-center gap-1 text-text-secondary shrink-0">
                    <span className="text-shop">★</span>
                    {post.likes_count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {trendingTopics.length > 0 && (
        <div className="home-rail-card p-5">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">Trending Topics</h3>
          <ul className="text-xs text-text space-y-1">
            {trendingTopics.map((topic) => (
              <li key={topic.topic}>
                <Link
                  href={`/tag/${encodeURIComponent(topic.topic)}`}
                  className="flex items-center justify-between hover:text-vault"
                >
                  <span className="truncate">#{topic.topic}</span>
                  <span className="text-text-secondary">
                    {topic.count} {topic.count === 1 ? 'post' : 'posts'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
