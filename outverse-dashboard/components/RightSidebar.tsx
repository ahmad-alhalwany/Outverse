'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getUser } from '@/lib/auth';
import { apiFetch, apiFetchJson } from '@/lib/api';
import EmotionMap from './EmotionMap';

import { apiUrl } from '@/lib/api';

const POSTS_API = apiUrl('posts/');
const USERS_API = apiUrl('users/');

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

const trendingPosts = [
  { title: 'How I Created a Cosmic Illustration', reactions: 320 },
  { title: 'Top 10 Space Art Tips', reactions: 275 },
  { title: 'Nebula Color Palettes', reactions: 210 },
];

const friendSuggestions = [
  { name: 'Emma', avatar: 'https://randomuser.me/api/portraits/women/65.jpg', mutual: 3 },
  { name: 'Noah', avatar: 'https://randomuser.me/api/portraits/men/66.jpg', mutual: 2 },
  { name: 'Olivia', avatar: 'https://randomuser.me/api/portraits/women/67.jpg', mutual: 1 },
];

export default function RightSidebar() {
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);

  useEffect(() => {
    let active = true;

    fetch(`${POSTS_API}trending/`)
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
    try {
      const res = await apiFetchJson('users/follow/', {
        method: 'POST',
        json: { following_id: creator.id },
      });
      if (res.ok) {
        const data = await res.json();
        setCreators((prev) =>
          prev.map((c) =>
            c.id === creator.id
              ? {
                  ...c,
                  is_following: data.is_following,
                  followers_count: data.followers_count,
                }
              : c
          )
        );
      }
    } catch {
      /* ignore */
    }
  };

  const trendingTopics = (() => {
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
  })();

  return (
    <aside className="w-80 pt-20 px-4 hidden xl:block">
      <div className="card p-4 mb-6">
        <h3 className="text-xs font-semibold text-text-secondary mb-2">Global Emotion Map</h3>
        <EmotionMap />
        <Link
          href="/bottles"
          className="mt-2 block text-center text-[11px] font-semibold text-vault hover:underline"
        >
          Open full vault →
        </Link>
      </div>

      <div className="card p-4 mb-6">
        <h3 className="text-xs font-semibold text-text-secondary mb-3 flex items-center gap-1">
          <span>Creators to Follow</span>
          <span className="text-bazaar text-base">✨</span>
        </h3>
        {creators.length === 0 ? (
          <p className="text-xs text-text-secondary">No suggestions yet.</p>
        ) : (
          <ul className="text-xs text-text space-y-2">
            {creators.map((creator) => (
              <li key={creator.id} className="flex items-center justify-between">
                <Link href={`/profile/${creator.id}`} className="flex items-center gap-2 min-w-0 group">
                  {creator.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={creator.avatar}
                      alt={creator.username}
                      className="w-8 h-8 rounded-full border-2 border-vault/40 object-cover"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-vault to-bazaar text-white flex items-center justify-center text-[10px] font-bold">
                      {initials(creator.username)}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block font-medium truncate group-hover:underline">{creator.username}</span>
                    <span className="block text-text-secondary text-[10px]">
                      {creator.followers_count} {creator.followers_count === 1 ? 'follower' : 'followers'}
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
      </div>

      <div className="card p-4 mb-6">
        <h3 className="text-xs font-semibold text-text-secondary mb-3 flex items-center gap-1">
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
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-text-secondary mb-2">Trending Topics</h3>
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
<<<<<<< HEAD
      )}
=======
        <div className="text-xs text-gray-400 mt-2">1,234 creators active</div>
      </div>
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-500 mb-2">Active Friends</h3>
        <div className="flex -space-x-2 mb-2">
          {activeFriends.map(friend => (
            <img key={friend.name} src={friend.avatar} alt={friend.name} className="w-8 h-8 rounded-full border-2 border-white" title={friend.name} />
          ))}
        </div>
        <ul className="text-xs text-gray-700">
          {activeFriends.map(friend => (
            <li key={friend.name} className="flex items-center space-x-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
              <span>{friend.name}</span>
              <span className="text-gray-400">({friend.mood})</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
          <span>Friend Suggestions</span>
          <span className="text-blue-400 text-base">✨</span>
        </h3>
        <ul className="text-xs text-gray-700">
          {friendSuggestions.map(friend => (
            <li key={friend.name} className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2">
                <span className="relative">
                  <img src={friend.avatar} alt={friend.name} className="w-8 h-8 rounded-full border-2 border-blue-200 hover:border-blue-400 transition" />
                  <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-gradient-to-tr from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white text-xs">+</span>
                </span>
                <span>{friend.name}</span>
                <span className="text-gray-400">({friend.mutual} mutual)</span>
              </span>
              <button className="bg-blue-100 hover:bg-blue-300 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold transition" title="Add Friend">+</button>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
          <span>Trending Posts</span>
          <span className="text-yellow-400 text-base">🌠</span>
        </h3>
        <ul className="text-xs text-gray-700">
          {trendingPosts.map(post => (
            <li key={post.title} className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gradient-to-tr from-purple-400 to-blue-400 mr-1"></span>
                {post.title}
              </span>
              <span className="flex items-center gap-1 text-gray-400">
                <span className="text-pink-400">★</span>
                {post.reactions}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="text-xs font-semibold text-gray-500 mb-2">Trending Topics</h3>
        <ul className="text-xs text-gray-700">
          {trendingTopics.map(topic => (
            <li key={topic.topic} className="flex items-center justify-between mb-1">
              <span>{topic.topic}</span>
              <span className="text-gray-400">{topic.posts.toLocaleString()} posts</span>
            </li>
          ))}
        </ul>
      </div>
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
    </aside>
  );
}
