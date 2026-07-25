'use client';

import { motion } from 'framer-motion';
import { useLocale } from '@/components/LocaleProvider';
import type { HomeFeed } from '@/lib/postsApi';

export default function FeedTabs({
  feed,
  onChange,
  postCount,
}: {
  feed: HomeFeed;
  onChange: (f: HomeFeed) => void;
  postCount?: number;
}) {
  const { t } = useLocale();
  const tabs: { key: HomeFeed; label: string }[] = [
    { key: 'for_you', label: t('feed.feedForYou') },
    { key: 'following', label: t('feed.feedFollowing') },
    { key: 'joined', label: t('feed.feedResonance') },
    { key: 'discover', label: t('feed.feedDiscover') },
  ];
  return (
    <div className="feed-tabs sticky top-[4.5rem] z-20 py-3 mb-4 -mx-1 px-1 backdrop-blur-md rounded-xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-full bg-surface/80 border border-vault/10">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className="relative px-4 py-2 rounded-full text-sm font-semibold transition-colors z-10"
              style={{ color: feed === tab.key ? '#fff' : undefined }}
            >
              {feed === tab.key && (
                <motion.div
                  layoutId="homeFeedTab"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-vault via-bazaar to-lab shadow-lg"
                  style={{ zIndex: -1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className={feed === tab.key ? 'text-white' : 'text-text-secondary'}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
        {postCount != null && (
          <span className="text-xs text-text-secondary font-medium">
            {postCount} {postCount === 1 ? 'post' : 'posts'}
          </span>
        )}
      </div>
    </div>
  );
}
