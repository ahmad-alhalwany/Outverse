'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import { memo } from 'react';
import type PostCardComponent from '../PostCard';
import PostFeedSkeleton from './PostFeedSkeleton';

const PostCard = dynamic(() => import('../PostCard'), {
  loading: () => <PostFeedSkeleton count={1} />,
});

export type MappedPost = ComponentProps<typeof PostCardComponent>;

interface HomePostListProps {
  posts: MappedPost[];
  onDeleted: () => void;
  onUpdated: () => void;
}

function HomePostList({ posts, onDeleted, onUpdated }: HomePostListProps) {
  return (
    <div className="home-post-list">
      {posts.map((post, idx) => (
        <div
          key={post.id || idx}
          className={`mb-8 home-post-list__item${idx < 4 ? ' home-post-list__item--enter' : ''}`}
          style={idx < 4 ? { animationDelay: `${Math.min(idx * 0.05, 0.2)}s` } : undefined}
        >
          <PostCard
            {...post}
            variant="premium"
            onDeleted={onDeleted}
            onUpdated={onUpdated}
          />
        </div>
      ))}
    </div>
  );
}

export default memo(HomePostList);
