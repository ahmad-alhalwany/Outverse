'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { PlusIcon, SparklesIcon, ArchiveBoxIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { fetchStoryRings, fetchFollowingStoryRings, trackStoryView, mapStoryFromApi, type StoryItem, type StoryRing } from '@/lib/storyUtils';
import { apiFetch } from '@/lib/api';
import { StoryModal, AddStoryModal } from '@/components/StoriesSidebar';
import StoryRingAvatar from '@/components/stories/StoryRingAvatar';
import StoryArchiveModal from '@/components/stories/StoryArchiveModal';

export default function HomeStoriesRail({ onRefresh }: { onRefresh?: () => void }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [rings, setRings] = useState<StoryRing[]>([]);
  const [playlist, setPlaylist] = useState<StoryItem[]>([]);
  const [spotlight, setSpotlight] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStory, setShowStory] = useState<StoryItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [feedMode, setFeedMode] = useState<'all' | 'following'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fetcher = feedMode === 'following' ? fetchFollowingStoryRings : fetchStoryRings;
      const [{ rings: r, flat }, spotlightRes] = await Promise.all([
        fetcher(),
        apiFetch('stories/spotlight/'),
      ]);
      setRings(r);
      setPlaylist(flat);
      if (spotlightRes.ok) {
        const data = await spotlightRes.json();
        const list = Array.isArray(data) ? data : data?.results || [];
        setSpotlight(list.map((s: Record<string, unknown>) => mapStoryFromApi(s)));
      } else {
        setSpotlight([]);
      }
    } catch {
      setRings([]);
      setPlaylist([]);
      setSpotlight([]);
    } finally {
      setLoading(false);
    }
  }, [feedMode]);

  useEffect(() => {
    load();
  }, [load]);

  const currentIdx = showStory ? playlist.findIndex((s) => s.id === showStory.id) : -1;

  useEffect(() => {
    if (showStory?.id) trackStoryView(showStory.id);
  }, [showStory?.id]);

  useEffect(() => {
    const storyParam = searchParams.get('story');
    if (!storyParam) return;
    const sid = Number(storyParam);
    if (!Number.isFinite(sid)) return;
    const fromPlaylist = playlist.find((s) => s.id === sid);
    if (fromPlaylist) {
      setShowStory(fromPlaylist);
      return;
    }
    void (async () => {
      try {
        const res = await apiFetch(`stories/${sid}/`);
        if (!res.ok) return;
        const raw = await res.json();
        setShowStory(mapStoryFromApi(raw as Record<string, unknown>));
      } catch {
        /* ignore */
      }
    })();
  }, [searchParams, playlist]);

  useEffect(() => {
    const storyParam = searchParams.get('story');
    if (!storyParam || !showStory) return;
    if (Number(storyParam) !== showStory.id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('story');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [showStory, searchParams, pathname, router]);

  const openRing = (ring: StoryRing) => {
    if (ring.items.length > 0) setShowStory(ring.items[0]);
  };

  return (
    <section className="home-stories-rail mb-6 rounded-2xl relative overflow-visible">
      <div className="story-rail-glow" aria-hidden />

      {spotlight.length > 0 && (
        <div className="relative z-10 mb-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-text flex items-center gap-1.5">
              <SparklesIcon className="h-4 w-4 text-bazaar" />
              Spotlight
            </h2>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              Featured snaps
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {spotlight.map((story) => (
              <button
                key={story.id}
                type="button"
                onClick={() => setShowStory(story)}
                className="group relative h-36 w-28 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-surface text-left shadow-sm"
              >
                {story.media[0]?.type === 'video' && story.media[0]?.url ? (
                  <video src={story.media[0].url} muted playsInline className="h-full w-full object-cover" />
                ) : story.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={story.mediaUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-vault/70 to-bazaar/70 px-3 text-center text-xs font-semibold text-white">
                    {story.text || 'Spotlight'}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 text-white">
                  <p className="truncate text-xs font-semibold">{story.name}</p>
                  {story.views ? <p className="text-[10px] text-white/75">{story.views} views</p> : null}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 relative z-10">
        <div>
          <h2 className="text-sm font-bold text-text flex items-center gap-1.5">
            <SparklesIcon className="h-4 w-4 text-vault" />
            Cosmic Stories
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">Watch · react · orbit the feed</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-surface p-0.5 text-[10px] font-semibold">
            <button
              type="button"
              className={`px-2.5 py-1 rounded-full ${feedMode === 'all' ? 'bg-vault text-white' : 'text-text-secondary'}`}
              onClick={() => setFeedMode('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 rounded-full ${feedMode === 'following' ? 'bg-vault text-white' : 'text-text-secondary'}`}
              onClick={() => setFeedMode('following')}
            >
              Following
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowArchive(true)}
            className="story-rail-archive-btn"
            aria-label="Story archive"
            title="Story archive"
          >
            <ArchiveBoxIcon className="h-4 w-4" />
          </button>
          <Link href="/stories/map" className="story-rail-archive-btn" aria-label="Story map" title="Story map">
            <MapPinIcon className="h-4 w-4" />
          </Link>
          <button type="button" onClick={() => setShowAdd(true)} className="cosmic-btn text-xs gap-1 !px-3 !py-2">
            <PlusIcon className="h-4 w-4" />
            Add story
          </button>
        </div>
      </div>

      <div className="relative z-10">
        {loading ? (
          <div className="story-rail-track flex gap-5 overflow-x-auto py-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="shrink-0 flex flex-col items-center gap-2">
                <div className="w-20 h-20 sm:w-[5.25rem] sm:h-[5.25rem] rounded-full skeleton-pulse" />
                <div className="w-14 h-2.5 rounded skeleton-pulse" />
              </div>
            ))}
          </div>
        ) : rings.length === 0 ? (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="story-rail-empty w-full py-10 rounded-xl text-sm font-medium transition"
          >
            <span className="text-2xl block mb-2">✨</span>
            Launch your first story into orbit
          </button>
        ) : (
          <div className="story-rail-track flex gap-5 sm:gap-6 overflow-x-auto snap-x snap-mandatory">
            {rings.map((ring, i) => (
              <motion.div
                key={ring.userId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="story-rail-item"
              >
                <StoryRingAvatar
                  name={ring.name}
                  avatar={ring.avatar}
                  count={ring.count}
                  size="md"
                  isNew={ring.isNew}
                  mood={ring.mood}
                  isLocked={ring.isLocked}
                  audience={ring.audience}
                  onClick={() => openRing(ring)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {showStory && (
        <StoryModal
          story={showStory}
          onClose={() => setShowStory(null)}
          onPrev={() => currentIdx > 0 && setShowStory(playlist[currentIdx - 1])}
          onNext={() => currentIdx < playlist.length - 1 && setShowStory(playlist[currentIdx + 1])}
          hasPrev={currentIdx > 0}
          hasNext={currentIdx < playlist.length - 1}
          onDeleted={() => load()}
          onMuted={() => load()}
          onUnlocked={async () => {
            try {
              const res = await apiFetch(`stories/${showStory.id}/`);
              if (res.ok) {
                setShowStory(mapStoryFromApi((await res.json()) as Record<string, unknown>));
              }
            } catch {
              /* ignore */
            }
          }}
        />
      )}
      {showAdd && (
        <AddStoryModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            load();
            onRefresh?.();
          }}
        />
      )}
      {showArchive && <StoryArchiveModal onClose={() => setShowArchive(false)} />}
    </section>
  );
}
