'use client';

import Link from 'next/link';
import { PlayIcon } from '@heroicons/react/24/outline';
import { reelPagePath } from '@/lib/fetchReel';

interface QuotedReelProps {
  id?: number;
  caption?: string;
  username?: string;
  videoUrl?: string | null;
}

/**
 * Compact, read-only rendering of a Reel embedded inside a cross-posted
 * card in the main feed. Clicking navigates to the reel. Mirrors
 * QuotedPost's cross-content embed pattern.
 */
export default function QuotedReel({ id, caption, username, videoUrl }: QuotedReelProps) {
  const inner = (
    <div className="quoted-post">
      <div className="quoted-post__head">
        <PlayIcon className="h-4 w-4 shrink-0" />
        <span className="quoted-post__name">@{username || 'someone'}</span>
      </div>
      {caption && <p className="quoted-post__text">{caption}</p>}
      {videoUrl && (
        <div className="quoted-post__media">
          <video
            src={videoUrl}
            className="quoted-post__cover"
            muted
            playsInline
            preload="metadata"
          />
        </div>
      )}
    </div>
  );

  if (id) {
    return (
      <Link href={reelPagePath(id)} className="quoted-post__link">
        {inner}
      </Link>
    );
  }
  return inner;
}
