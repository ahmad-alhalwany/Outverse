'use client';

import {
  ChatBubbleLeftRightIcon,
  EyeIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';
import PostReactions from './PostReactions';
import { useLocale } from './LocaleProvider';

interface PostEngagementBarProps {
  onReaction: (emoji: string) => void;
  selectedReaction?: string;
  reactionCounts?: Record<string, number>;
  views: number;
  commentsCount: number;
  sharesCount: number;
  commentsOpen: boolean;
  onCommentsToggle: () => void;
  onShare: () => void;
}

export default function PostEngagementBar({
  onReaction,
  selectedReaction,
  reactionCounts,
  views,
  commentsCount,
  sharesCount,
  commentsOpen,
  onCommentsToggle,
  onShare,
}: PostEngagementBarProps) {
  const { t } = useLocale();
  return (
    <div className="post-engagement">
      <div className="post-engagement__reactions-wrap">
        <PostReactions
          onReaction={onReaction}
          selectedReaction={selectedReaction}
          reactionCounts={reactionCounts}
        />
      </div>

      <div className="post-engagement__actions">
        <span className="post-engagement__stat" title={t('feed.views')}>
          <EyeIcon className="h-4 w-4 opacity-70" />
          {views > 0 ? views.toLocaleString() : '—'}
        </span>

        <button
          type="button"
          onClick={onCommentsToggle}
          className={`post-engagement__chip${commentsOpen ? ' post-engagement__chip--active' : ''}`}
          aria-expanded={commentsOpen}
        >
          <ChatBubbleLeftRightIcon className="h-4 w-4" />
          <span className="hidden sm:inline">
            {commentsOpen ? t('feed.hideComments') : t('feed.discuss')}
          </span>
          {commentsCount > 0 && (
            <span className="post-engagement__count" aria-label={`${commentsCount} comments`}>
              {commentsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onShare}
          className="post-engagement__chip post-engagement__chip--share"
        >
          <ShareIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{t('feed.share')}</span>
          {sharesCount > 0 && (
            <span className="post-engagement__count">{sharesCount}</span>
          )}
        </button>
      </div>
    </div>
  );
}
