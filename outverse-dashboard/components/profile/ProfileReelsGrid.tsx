'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PlayIcon, TrashIcon } from '@heroicons/react/24/solid';
import { apiFetch } from '@/lib/api';
import { getCurrentUserId } from '@/lib/auth';
import { reelPagePath } from '@/lib/fetchReel';
import ReelsIcon from '@/components/icons/ReelsIcon';
import type { ReelItem } from '@/lib/reelTypes';
import { formatCount } from '@/lib/profileEmotions';
import { mediaUrl } from '@/lib/api';
import { useLocale } from '@/components/LocaleProvider';

interface ProfileReelsGridProps {
  userId: string;
  palette: {
    text: string;
    text2: string;
    white: string;
    line: string;
    shadowSm: string;
    card: string;
    card2: string;
    brown: string;
  };
}

export default function ProfileReelsGrid({ userId, palette: C }: ProfileReelsGridProps) {
  const { t } = useLocale();
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isOwn = String(getCurrentUserId()) === String(userId);

  const load = () => {
    setLoading(true);
    apiFetch(`reels/?user=${userId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setReels(Array.isArray(data) ? data : []))
      .catch(() => setReels([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [userId]);

  const removeReel = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(t('reels.confirmDeleteReel'))) return;
    try {
      const res = await apiFetch(`reels/${id}/`, { method: 'DELETE' });
      if (res.ok) setReels((prev) => prev.filter((r) => r.id !== id));
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <span className="reels-feed__orb reels-feed__orb--small" />
        <p className="text-sm" style={{ color: C.text2 }}>
          Loading signals…
        </p>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="text-center py-12">
        <ReelsIcon size={40} className="mx-auto mb-3 opacity-70" />
        <p className="text-sm" style={{ color: C.text2 }}>
          No signals launched yet.
        </p>
        {isOwn && (
          <Link
            href="/reels/create"
            className="inline-block mt-3 text-sm font-semibold"
            style={{ color: C.brown }}
          >
            Launch a signal →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="profile-reels-grid">
      {reels.map((reel) => {
        const thumb = mediaUrl(reel.video) || reel.video;
        return (
          <Link
            key={reel.id}
            href={reelPagePath(reel.id)}
            className="profile-reels-grid__card"
            style={{
              background: C.white,
              border: `1px solid ${C.line}`,
              boxShadow: C.shadowSm,
            }}
          >
            <div className="profile-reels-grid__thumb">
              <video
                src={thumb}
                className="profile-reels-grid__video"
                muted
                playsInline
                preload="metadata"
                onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                onMouseLeave={(e) => {
                  e.currentTarget.pause();
                  e.currentTarget.currentTime = 0;
                }}
              />
              {isOwn && (
                <button
                  type="button"
                  className="profile-reels-grid__delete"
                  onClick={(e) => removeReel(e, reel.id)}
                  aria-label={t('reels.deleteReel')}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
              <span className="profile-reels-grid__play">
                <PlayIcon className="h-5 w-5" />
              </span>
              <span className="profile-reels-grid__stat">
                ▶ {formatCount(reel.views)}
              </span>
            </div>
            <p className="profile-reels-grid__caption" style={{ color: C.text }}>
              {(reel.caption || 'Signal').slice(0, 42)}
              {(reel.caption?.length ?? 0) > 42 ? '…' : ''}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
