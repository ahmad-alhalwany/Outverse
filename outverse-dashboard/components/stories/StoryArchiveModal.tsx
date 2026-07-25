'use client';

import { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { fetchStoryArchive, type StoryItem } from '@/lib/storyUtils';
import { backgroundCss } from '@/lib/storyStudio';
import { StoryModal } from '@/components/StoriesSidebar';

/** Story Archive — every story you've ever posted, kept privately for you
 * to rewatch even after it expires for everyone else, like IG's Archive. */
export default function StoryArchiveModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStory, setShowStory] = useState<StoryItem | null>(null);

  useEffect(() => {
    fetchStoryArchive().then((list) => {
      setItems(list);
      setLoading(false);
    });
  }, []);

  const idx = showStory ? items.findIndex((s) => s.id === showStory.id) : -1;

  return (
    <div className="story-archive-backdrop" onClick={onClose}>
      <div className="story-archive-shell" onClick={(e) => e.stopPropagation()}>
        <div className="story-archive-header">
          <h3>Story Archive</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        {loading ? (
          <p className="story-archive-empty">Loading…</p>
        ) : items.length === 0 ? (
          <p className="story-archive-empty">No stories yet — everything you post lands here privately, even after it expires for others.</p>
        ) : (
          <div className="story-archive-grid">
            {items.map((item) => (
              <button key={item.id} type="button" className="story-archive-thumb" onClick={() => setShowStory(item)}>
                {item.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.mediaUrl} alt="" />
                ) : (
                  <div className="story-archive-thumb-text" style={{ background: backgroundCss(item.backgroundStyle) }}>
                    <span>{item.text.slice(0, 40) || '✨'}</span>
                  </div>
                )}
                <span className="story-archive-thumb-date">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {showStory && (
        <StoryModal
          story={showStory}
          onClose={() => setShowStory(null)}
          onPrev={() => idx > 0 && setShowStory(items[idx - 1])}
          onNext={() => idx < items.length - 1 && setShowStory(items[idx + 1])}
          hasPrev={idx > 0}
          hasNext={idx < items.length - 1}
        />
      )}
    </div>
  );
}
