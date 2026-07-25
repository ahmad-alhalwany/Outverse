'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { apiFetch, mediaUrl } from '@/lib/api';
import { formatRelativeTime } from '@/utils/dateFormatter';

const StoryMapInner = dynamic(() => import('./StoryMapInner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center rounded-3xl bg-surface text-sm text-text-secondary">
      Loading story map...
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
  const video = row.video;

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
  const [pins, setPins] = useState<StoryMapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('stories/map/');
      if (!res.ok) throw new Error('map failed');
      const data = await res.json();
      const rows = Array.isArray(data) ? data : data?.results || [];
      setPins(rows.map(storyPinFromApi).filter((pin: StoryMapPin | null): pin is StoryMapPin => !!pin));
    } catch {
      setError('Could not load story map.');
      setPins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const latestPins = useMemo(() => pins.slice(0, 6), [pins]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-text-secondary hover:text-vault">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to home
          </Link>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-[-0.03em] text-text">
            <MapPinIcon className="h-8 w-8 text-vault" />
            Story Map
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Explore snaps shared with location across Cosmory.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-[560px] items-center justify-center rounded-3xl bg-surface text-sm text-text-secondary">
          Loading story map...
        </div>
      ) : (
        <StoryMapInner pins={pins} />
      )}

      <section className="rounded-3xl border border-surface bg-white/70 p-4 shadow-sm dark:bg-white/[0.04]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-text">Latest mapped stories</h2>
          <span className="text-xs font-semibold text-text-secondary">{pins.length} pins</span>
        </div>
        {latestPins.length === 0 ? (
          <p className="text-sm text-text-secondary">No located stories yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {latestPins.map((pin) => (
              <Link
                key={pin.id}
                href={`/?story=${pin.id}`}
                className="group flex gap-3 rounded-2xl border border-surface bg-surface/70 p-3 transition hover:border-vault/40 hover:bg-vault/10"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-vault/15">
                  {pin.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pin.thumbnail} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg">✨</div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-text">@{pin.author}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-text-secondary">
                    <MapPinIcon className="h-3.5 w-3.5 shrink-0" />
                    {pin.locationName}
                  </p>
                  {pin.createdAt && (
                    <p className="mt-1 text-[11px] text-text-secondary">{formatRelativeTime(pin.createdAt)}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
