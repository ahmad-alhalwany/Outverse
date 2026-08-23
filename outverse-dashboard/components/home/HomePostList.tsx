'use client';

import { memo, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type PostCardComponent from '../PostCard';
import PostFeedSkeleton from './PostFeedSkeleton';
import { useAd, Ad as AdComponent } from '@/components/ui/AdFeed';
import type { Ad } from '@/lib/adsApi';

const PostCard = dynamic(() => import('../PostCard'), {
  loading: () => <PostFeedSkeleton count={1} />,
});

export type MappedPost = ComponentProps<typeof PostCardComponent>;

/** A sponsored-slot sentinel interleaved into the feed — not a real post. */
type AdSlot = { id: number; is_ad: true; ad_data: Ad; variant: 'premium' };
type FeedItem = MappedPost | AdSlot;

function isAdSlot(item: FeedItem): item is AdSlot {
  return (item as AdSlot).is_ad === true;
}

interface HomePostListProps {
  posts: MappedPost[];
  onDeleted: (id: number) => void;
  adInterval?: number; // Show ad every N posts (default: 5)
  adPlacement?: 'feed' | 'stories' | 'reels' | 'explore' | 'profile';
}

function HomePostList({
  posts,
  onDeleted,
  adInterval = 5,
  adPlacement = 'feed',
}: HomePostListProps) {
  const [adItems, setAdItems] = useState<AdSlot[]>([]);
  const { ad: currentAd } = useAd(adPlacement);

  // When we get an ad, insert it into the posts array
  useEffect(() => {
    if (currentAd) {
      // A sponsored-slot sentinel. Offset the id well past real post ids so
      // it can't collide when used as a React key.
      const adPost: AdSlot = {
        id: 1_000_000_000 + currentAd.id,
        is_ad: true,
        ad_data: currentAd,
        variant: 'premium',
      };
      setAdItems([adPost]);
    }
  }, [currentAd]);

  // Interleave ads into posts
  const interleavedPosts: FeedItem[] = [];
  posts.forEach((post, index) => {
    interleavedPosts.push(post);
    // Insert ad after every N posts
    if ((index + 1) % adInterval === 0 && adItems.length > 0 && adItems[0]) {
      interleavedPosts.push(adItems[0]);
    }
  });

  // Post cards vary wildly in height (a text-only post vs. a media-rich one
  // can differ by 4x), which made virtualized/estimated-height positioning
  // (previously @tanstack/react-virtual) unreliable — rows overlapped or left
  // large gaps whenever real height diverged from the estimate. A plain list
  // is simpler and correct at the feed sizes this app actually renders.
  return (
    <div className="home-post-list" role="feed" aria-label="Posts feed">
      {interleavedPosts.map((post, index) => (
        <div
          key={post.id}
          className={`mb-8 home-post-list__item${index < 4 ? ' home-post-list__item--enter' : ''}`}
          style={index < 4 ? { animationDelay: `${Math.min(index * 0.05, 0.2)}s` } : undefined}
        >
          {isAdSlot(post) ? (
            <AdComponent ad={post.ad_data} placement={adPlacement} />
          ) : (
            <PostCard
              {...post}
              variant="premium"
              onDeleted={onDeleted}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default memo(HomePostList);
