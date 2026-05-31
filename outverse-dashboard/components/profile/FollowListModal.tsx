'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { apiUrl, mediaUrl } from '@/lib/api';
import { apiFetch } from '@/lib/api';

type UserRow = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
  bio?: string | null;
};

type Props = {
  userId: string;
  mode: 'followers' | 'following';
  title: string;
  colors: Record<string, string>;
  onClose: () => void;
};

function displayName(u: UserRow) {
  const full = `${u.first_name || ''} ${u.last_name || ''}`.trim();
  return full || u.username;
}

export default function FollowListModal({ userId, mode, title, colors: C, onClose }: Props) {
  const [list, setList] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `users/${userId}/${mode}/`,
      );
      if (res.ok) setList(await res.json());
      else setList([]);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [userId, mode]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm max-h-[70vh] rounded-2xl flex flex-col overflow-hidden"
        style={{ background: C.cream, border: `1px solid ${C.line}`, color: C.text }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: C.line }}>
          <h2 className="font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="text-xl px-2" aria-label="Close">
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {loading && (
            <p className="text-center text-sm py-8" style={{ color: C.text2 }}>
              Loading…
            </p>
          )}
          {!loading && list.length === 0 && (
            <p className="text-center text-sm py-8" style={{ color: C.text2 }}>
              No users yet.
            </p>
          )}
          {list.map((u) => {
            const av = u.avatar ? mediaUrl(u.avatar) : '';
            return (
              <Link
                key={u.id}
                href={`/profile/${u.id}`}
                onClick={onClose}
                className="flex items-center gap-3 p-2.5 rounded-xl transition hover:opacity-90"
                style={{ background: C.white, border: `1px solid ${C.line}` }}
              >
                {av ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={av} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <span
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: C.brown }}
                  >
                    {displayName(u).slice(0, 2)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{displayName(u)}</p>
                  <p className="text-xs truncate" style={{ color: C.text2 }}>
                    @{u.username}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
