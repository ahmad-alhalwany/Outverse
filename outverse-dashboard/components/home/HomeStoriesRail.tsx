'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PlusIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { fetchStoryRings, type StoryItem, type StoryRing } from '@/lib/storyUtils';
import { StoryModal, AddStoryModal } from '@/components/StoriesSidebar';
import StoryRingAvatar from '@/components/stories/StoryRingAvatar';

export default function HomeStoriesRail({ onRefresh }: { onRefresh?: () => void }) {
  const [rings, setRings] = useState<StoryRing[]>([]);
  const [playlist, setPlaylist] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStory, setShowStory] = useState<StoryItem | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { rings: r, flat } = await fetchStoryRings();
      setRings(r);
      setPlaylist(flat);
    } catch {
      setRings([]);
      setPlaylist([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currentIdx = showStory ? playlist.findIndex((s) => s.id === showStory.id) : -1;

  const openRing = (ring: StoryRing) => {
    if (ring.items.length > 0) setShowStory(ring.items[0]);
  };

  return (
    <section className="home-stories-rail mb-6 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
      <div className="story-rail-glow" aria-hidden />

      <div className="flex items-center justify-between mb-4 relative z-10">
        <div>
          <h2 className="text-sm font-bold text-text flex items-center gap-1.5">
            <SparklesIcon className="h-4 w-4 text-vault" />
            Cosmic Stories
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">Watch · react · orbit the feed</p>
        </div>
        <button type="button" onClick={() => setShowAdd(true)} className="cosmic-btn text-xs gap-1 !px-3 !py-2">
          <PlusIcon className="h-4 w-4" />
          Add story
        </button>
      </div>

      <div className="relative z-10">
        {loading ? (
          <div className="flex gap-5 overflow-hidden py-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="shrink-0 flex flex-col items-center gap-2">
                <div className="w-[4.5rem] h-[4.5rem] rounded-full skeleton-pulse" />
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
          <div className="flex gap-5 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin -mx-1 px-1">
            {rings.map((ring, i) => (
              <motion.div
                key={ring.userId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <StoryRingAvatar
                  name={ring.name}
                  avatar={ring.avatar}
                  count={ring.count}
                  size="md"
                  isNew={ring.isNew}
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
    </section>
  );
}
