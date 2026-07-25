'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { reelAuthorName, type ReelItem } from '@/lib/reelTypes';
import { useLocale } from '@/components/LocaleProvider';

interface ReelRemixBadgeProps {
  remixOfId: number;
  className?: string;
  linkToReel?: boolean;
  labelKey?: 'reels.remixOf' | 'reels.remixing' | 'reels.weaveOf' | 'reels.weaving';
}

export default function ReelRemixBadge({
  remixOfId,
  className = '',
  linkToReel = true,
  labelKey = 'reels.remixOf',
}: ReelRemixBadgeProps) {
  const { t } = useLocale();
  const [source, setSource] = useState<ReelItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch(`reels/${remixOfId}/`);
        if (!cancelled && res.ok) {
          setSource((await res.json()) as ReelItem);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [remixOfId]);

  const username = source ? reelAuthorName(source.user) : '…';
  const label = t(labelKey, { user: username });
  const isWeave = labelKey === 'reels.weaveOf' || labelKey === 'reels.weaving';
  const chipClass = `reel-slide__remix-chip${className ? ` ${className}` : ''}`;
  const mark = isWeave ? '⧉' : '↻';

  if (linkToReel) {
    return (
      <Link href={`/reels/${remixOfId}`} className={chipClass}>
        {mark} {label}
      </Link>
    );
  }

  return (
    <span className={chipClass}>
      {mark} {label}
    </span>
  );
}
