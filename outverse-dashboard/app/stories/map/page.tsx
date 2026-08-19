'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftIcon, MapPinIcon, PlusIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { apiFetch, mediaUrl } from '@/lib/api';
import { formatRelativeTime } from '@/utils/dateFormatter';
import { useLocale } from '@/components/LocaleProvider';
import './story-map.css';

const StoryMapInner = dynamic(() => import('./StoryMapInner'), {
  ssr: false,
  loading: () => (
    <div className="story-map-frame flex h-[560px] items-center justify-center text-sm text-violet-200">
      <div className="h-6 w-6 rounded-full border-2 border-violet-300 border-t-transparent animate-spin" />
    </div>
  ),
});

export type StoryMapPin = {
  id: number;
  lat: number;
  lng: number;
  locationName: string;
  author: string;
  avatar: string;
  thumbnail: string;
  text: string;
  createdAt: string;
};

function storyPinFromApi(row: Record<string, unknown>): StoryMapPin | null {
  const lat = Number(row.location_lat);
  const lng = Number(row.location_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const user = (row.user as Record<string, unknown>) || {};
  const media = (row.media as Record<string, unknown>) || {};
  const image = row.image || media.thumbnail;
  const video = media.video || row.video;

  return {
    id: Number(row.id),
    lat,
    lng,
    locationName: String(row.location_name || 'Story location'),
    author: String(user.username || user.first_name || 'Creator'),
    avatar: mediaUrl(String(user.avatar || '')),
    thumbnail: mediaUrl(String(image || video || '')),
    text: String(row.text || ''),
    createdAt: String(row.created_at || ''),
  };
}

export default function StoryMapPage() {
  const { t } = useLocale();
  const [pins, setPins] = useState<StoryMapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('stories/map/');
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || 'map failed');
      }
      const data = await res.json();
      const rows = Array.isArray(data) ? data : data?.results || [];
      setPins(rows.map(storyPinFromApi).filter((pin: StoryMapPin | null): pin is StoryMapPin => !!pin));
    } catch (err) {
      setError(err instanceof Error && err.message !== 'map failed' ? err.message : t('storyMap.loadError'));
      setPins([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const latestPins = useMemo(() => pins.slice(0, 8), [pins]);
  const cities = useMemo(() => new Set(pins.map((p) => p.locationName)).size, [pins]);

  return (
    <main className="story-map-page">
      <div className="story-map-shell mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/" className="story-map-back mb-3 inline-flex items-center gap-1 text-sm font-semibold">
              <ArrowLeftIcon className="h-4 w-4" />
              {t('storyMap.backToHome')}
            </Link>
            <div className="mb-2">
              <span className="story-map-kicker">
                <SparklesIcon className="h-3.5 w-3.5" />
                {t('storyMap.liveLocations')}
              </span>
            </div>
            <h1 className="story-map-title flex items-center gap-2 text-3xl font-extrabold sm:text-4xl">
              <MapPinIcon className="h-8 w-8 shrink-0 text-cyan-300" />
              {t('storyMap.title')}
            </h1>
            <p className="story-map-subtitle mt-2 text-sm sm:text-base">
              {t('storyMap.subtitle')}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="story-map-stats">
              <div className="story-map-stat">
                {t('storyMap.pinsStat')}<strong>{pins.length}</strong>
              </div>
              <div className="story-map-stat">
                {t('storyMap.placesStat')}<strong>{cities}</strong>
              </div>
            </div>
            <Link href="/?addStory=1" className="story-map-cta">
              <PlusIcon className="h-4 w-4" />
              {t('storyMap.addStoryCta')}
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border-2 border-red-400/50 bg-red-950/60 px-4 py-3 text-sm font-bold text-red-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className="story-map-frame flex h-[560px] items-center justify-center text-sm text-violet-200">
            {t('storyMap.loading')}
          </div>
        ) : (
          <StoryMapInner pins={pins} />
        )}

        <section className="story-map-list">
          <div className="story-map-list-head">
            <h2>{t('storyMap.latestMapped')}</h2>
            <span className="story-map-count">
              {pins.length === 1 ? t('storyMap.pinsCountOne', { count: '1' }) : t('storyMap.pinsCountMany', { count: String(pins.length) })}
            </span>
          </div>
          {latestPins.length === 0 ? (
            <p className="text-sm text-violet-200/90">
              {t('storyMap.emptyList')}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {latestPins.map((pin) => (
                <Link key={pin.id} href={`/?story=${pin.id}`} className="story-map-card group">
                  <div className="story-map-thumb">
                    {pin.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pin.thumbnail} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <span aria-hidden>✨</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="story-map-author truncate">@{pin.author}</p>
                    <p className="story-map-loc truncate">
                      <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
                      {pin.locationName}
                    </p>
                    {pin.createdAt && (
                      <p className="story-map-time">{formatRelativeTime(pin.createdAt)}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
