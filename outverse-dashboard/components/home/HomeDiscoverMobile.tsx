'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getUser } from '@/lib/auth';
import { apiFetch, apiFetchJson } from '@/lib/api';

type Creator = {
  id: number;
  username: string;
  avatar: string | null;
  is_following: boolean;
};

export default function HomeDiscoverMobile() {
  const [creators, setCreators] = useState<Creator[]>([]);

  useEffect(() => {
    const me = getUser()?.id;
    if (!me) return;
    apiFetch(me ? `users/suggestions/?exclude=${me}` : 'users/suggestions/')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCreators(Array.isArray(data) ? data.slice(0, 8) : []))
      .catch(() => setCreators([]));
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
            c.id === creator.id ? { ...c, is_following: data.is_following } : c,
          ),
        );
      }
    } catch {
      /* ignore */
    }
  };

  if (creators.length === 0) return null;

  return (
    <section className="xl:hidden mb-6 rounded-2xl p-4 border border-vault/10 bg-surface/60">
      <h3 className="text-sm font-bold text-text mb-3">Creators you might like</h3>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin">
        {creators.map((c) => (
          <div
            key={c.id}
            className="shrink-0 flex flex-col items-center gap-2 w-[4.5rem]"
          >
            <Link href={`/profile/${c.id}`} className="block">
              {c.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.avatar}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-vault/30"
                />
              ) : (
                <span className="w-14 h-14 rounded-full bg-gradient-to-tr from-vault to-bazaar text-white flex items-center justify-center text-xs font-bold">
                  {c.username.slice(0, 2).toUpperCase()}
                </span>
              )}
            </Link>
            <span className="text-[10px] font-medium truncate w-full text-center">
              {c.username}
            </span>
            <button
              type="button"
              onClick={() => toggleFollow(c)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                c.is_following
                  ? 'bg-vault/20 text-vault'
                  : 'bg-bazaar/15 text-bazaar'
              }`}
            >
              {c.is_following ? 'Following' : 'Follow'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
