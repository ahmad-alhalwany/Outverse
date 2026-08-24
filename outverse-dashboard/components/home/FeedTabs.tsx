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
  // 'discover' intentionally isn't a tab here anymore — /discover is now a
  // full standalone hub (posts + communities + people + reels), not just
  // this one ranked feed variant. The feed value itself still works via
  // direct URL (?feed=discover) for old links/bookmarks, just unlisted.
  const tabs: { key: HomeFeed; label: string }[] = [
    { key: 'for_you', label: t('feed.feedForYou') },
    { key: 'following', label: t('feed.feedFollowing') },
    { key: 'joined', label: t('feed.feedResonance') },
  ];
  return (
    <div className="feed-tabs sticky top-[4.5rem] z-20 py-3 mb-4 -mx-1 px-1 backdrop-blur-md rounded-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="feed-tabs__scroll min-w-0 overflow-x-auto">
          <div className="flex w-max gap-1 p-1 rounded-full bg-surface/80 border border-vault/10">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onChange(tab.key)}
                className="relative shrink-0 px-3 py-2 text-sm font-semibold transition-colors z-10 rounded-full sm:px-4"
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
        </div>
        {postCount != null && (
          <span className="hidden shrink-0 text-xs text-text-secondary font-medium sm:inline">
            {postCount} {postCount === 1 ? 'post' : 'posts'}
          </span>
        )}
      </div>
    </div>
  );
}
