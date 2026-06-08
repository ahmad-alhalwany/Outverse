'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { reelPagePath } from '@/lib/fetchReel';
import type { ReelItem } from '@/lib/reelTypes';
import { useLocale } from '../LocaleProvider';
import ReelSlide from './ReelSlide';

interface ReelDetailViewProps {
  reelId: string;
}

export default function ReelDetailView({ reelId }: ReelDetailViewProps) {
  const { t } = useLocale();
  const router = useRouter();
  const [reel, setReel] = useState<ReelItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMissing(false);
    try {
      const res = await apiFetch(`reels/${reelId}/`);
      if (res.ok) {
        setReel(await res.json());
      } else if (res.status === 404) {
        setReel(null);
        setMissing(true);
      } else {
        setReel(null);
      }
    } catch {
      setReel(null);
    } finally {
      setLoading(false);
    }
  }, [reelId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLike = async (id: number) => {
    if (!getUser()) return null;
    try {
      const res = await apiFetchJson(`reels/${id}/react/`, { method: 'POST' });
      if (res.ok) return res.json();
    } catch {
      /* ignore */
    }
    return null;
  };

  const handleView = async (id: number) => {
    try {
      await apiFetch(`reels/${id}/record_view/`, { method: 'POST' });
    } catch {
      /* ignore */
    }
  };

  const handleDeleted = () => {
    router.push('/reels');
  };

  if (loading) {
    return (
      <div className="reels-app reels-feed--loading">
        <div className="reels-feed__loader">
          <span className="reels-feed__orb" />
          <p>{t('reels.loading')}</p>
        </div>
      </div>
    );
  }

  if (missing || !reel) {
    return (
      <div className="reels-app reels-feed--empty">
        <p className="text-xl mb-2">🛸</p>
        <p>{t('reels.notFound')}</p>
        <Link href="/reels" className="mt-4 text-cyan-400 text-sm font-semibold">
          {t('reels.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="reels-app reels-app--single">
      <header className="reels-chrome__top reels-chrome__top--single">
        <Link href="/reels" className="reels-chrome__btn" aria-label={t('reels.back')}>
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <span className="reels-chrome__brand text-sm">{t('reels.singleTitle')}</span>
        <span className="w-10" />
      </header>
      <div className="reels-feed__snap reels-feed__snap--single">
        <ReelSlide
          reel={reel}
          active
          onLike={handleLike}
          onView={handleView}
          onDeleted={handleDeleted}
        />
      </div>
    </div>
  );
}
