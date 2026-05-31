'use client';

import { motion } from 'framer-motion';
import { useLocale } from '@/components/LocaleProvider';

type Feed = 'all' | 'following';

export default function FeedTabs({
  feed,
  onChange,
  postCount,
}: {
  feed: Feed;
  onChange: (f: Feed) => void;
  postCount?: number;
}) {
  const { t } = useLocale();
  return (
    <div className="feed-tabs sticky top-[4.5rem] z-20 py-3 mb-4 -mx-1 px-1 backdrop-blur-md rounded-xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-full bg-surface/80 border border-vault/10">
          {(['all', 'following'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              className="relative px-5 py-2 rounded-full text-sm font-semibold transition-colors z-10"
              style={{ color: feed === tab ? '#fff' : undefined }}
            >
              {feed === tab && (
                <motion.div
                  layoutId="homeFeedTab"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-vault via-bazaar to-lab shadow-lg"
                  style={{ zIndex: -1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className={feed === tab ? 'text-white' : 'text-text-secondary'}>
                {tab === 'all' ? t('feed.feedAll') : t('feed.feedFollowing')}
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
