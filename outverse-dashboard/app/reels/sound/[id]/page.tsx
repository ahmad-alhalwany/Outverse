'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PlayIcon, MusicalNoteIcon } from '@heroicons/react/24/solid';
import { ArrowLeftIcon, SparklesIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch, mediaUrl } from '@/lib/api';
import { reelPagePath } from '@/lib/fetchReel';
import { formatCount } from '@/lib/profileEmotions';
import { musicTrackPlaybackUrl, type ReelItem, type ReelMusicTrack } from '@/lib/reelTypes';

export default function ReelSoundPage() {
  const { t } = useLocale();
  const params = useParams<{ id: string }>();
  const trackId = params?.id;
  const [track, setTrack] = useState<ReelMusicTrack | null>(null);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const audioUrl = track ? musicTrackPlaybackUrl(track) : null;

  const load = useCallback(async () => {
    if (!trackId) return;
    setLoading(true);
    try {
      const [trackRes, reelsRes] = await Promise.all([
        apiFetch(`reel-music/${trackId}/`),
        apiFetch(`reels/?music_track=${trackId}`),
      ]);
      if (trackRes.ok) setTrack(await trackRes.json());
      if (reelsRes.ok) {
        const data = await reelsRes.json();
        setReels(Array.isArray(data) ? data : data.results || []);
      }
    } finally {
      setLoading(false);
    }
  }, [trackId]);

  useEffect(() => {
    load();
  }, [load]);

  const signalsLabel =
    reels.length === 1
      ? t('reels.soundSignals', { count: reels.length })
      : t('reels.soundSignalsPlural', { count: reels.length });

  return (
    <AppShell className="min-h-screen bg-background text-text" maxWidth="max-w-3xl">
      <div className="py-6">
        <Link href="/reels" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text mb-6">
          <ArrowLeftIcon className="h-4 w-4" />
          {t('reels.backToReels')}
        </Link>

        <div className="flex items-center gap-4 mb-6">
          <span className="h-16 w-16 rounded-2xl flex items-center justify-center bg-surface">
            <MusicalNoteIcon className="h-8 w-8 text-vault" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold truncate">{track?.title || t('reels.soundTitle')}</h1>
            <p className="text-sm text-text-secondary truncate">{track?.artist_label || 'Cosmory'}</p>
            <p className="text-xs text-text-secondary mt-0.5">{signalsLabel}</p>
          </div>
        </div>

        {audioUrl && (
          <div className="mb-6 rounded-2xl border border-surface p-4">
            <audio controls src={audioUrl} className="w-full mb-3" />
            <Link
              href={`/reels/create?music_track=${trackId}`}
              className="inline-flex items-center gap-2 rounded-full bg-vault text-white px-4 py-2 text-sm font-semibold hover:opacity-90"
            >
              <SparklesIcon className="h-4 w-4" />
              {t('reels.useThisSound')}
            </Link>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <span className="reels-feed__orb reels-feed__orb--small" />
            <p className="text-sm text-text-secondary">{t('reels.soundLoading')}</p>
          </div>
        ) : reels.length === 0 ? (
          <div className="text-center py-12 text-sm text-text-secondary">
            {t('reels.soundEmpty')}
            {trackId && (
              <div className="mt-4">
                <Link
                  href={`/reels/create?music_track=${trackId}`}
                  className="inline-flex items-center gap-2 text-vault font-semibold"
                >
                  <SparklesIcon className="h-4 w-4" />
                  {t('reels.soundBeFirst')}
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="profile-reels-grid">
            {reels.map((reel) => {
              const thumb = mediaUrl(reel.video) || reel.video;
              return (
                <Link
                  key={reel.id}
                  href={reelPagePath(reel.id)}
                  className="profile-reels-grid__card bg-surface border border-surface"
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
                    <span className="profile-reels-grid__play">
                      <PlayIcon className="h-5 w-5" />
                    </span>
                    <span className="profile-reels-grid__stat">
                      ▶ {formatCount(reel.views)}
                    </span>
                  </div>
                  <p className="profile-reels-grid__caption">
                    {(reel.caption || t('reels.signalFallback')).slice(0, 42)}
                    {(reel.caption?.length ?? 0) > 42 ? '…' : ''}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
