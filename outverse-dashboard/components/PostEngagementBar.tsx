'use client';

import { useMemo, useState } from 'react';
import {
  ChatBubbleLeftRightIcon,
  EyeIcon,
  ShareIcon,
  ArrowPathRoundedSquareIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import PostReactions from './PostReactions';
import ReactionSummaryLine from './ReactionSummaryLine';
import ReactorsModal from './ReactorsModal';
import { useLocale } from './LocaleProvider';
import { COSMIC_REACTIONS, type ReactionType } from '@/lib/reactions';

interface PostEngagementBarProps {
  onReaction: (emoji: string) => void;
  selectedReaction?: string;
  reactionCounts?: Record<string, number>;
  topReactors?: { id: number; name: string; username?: string; type?: string }[];
  postId?: number;
  views: number;
  commentsCount: number;
  sharesCount: number;
  repostsCount?: number;
  reposted?: boolean;
  commentsOpen: boolean;
  onCommentsToggle: () => void;
  onShare: () => void;
  onRepost?: () => void;
  onQuote?: () => void;
}

export default function PostEngagementBar({
  onReaction,
  selectedReaction,
  reactionCounts = {},
  topReactors = [],
  postId,
  views,
  commentsCount,
  sharesCount,
  repostsCount = 0,
  reposted = false,
  commentsOpen,
  onCommentsToggle,
  onShare,
  onRepost,
  onQuote,
}: PostEngagementBarProps) {
  const { t } = useLocale();
  const [repostMenu, setRepostMenu] = useState(false);
  const [showReactors, setShowReactors] = useState(false);
  const showRepost = !!(onRepost || onQuote);

  const totalReactions = useMemo(
    () => Object.values(reactionCounts).reduce((s, n) => s + (n || 0), 0),
    [reactionCounts],
  );

  const filteredTop = useMemo(() => {
    if (!selectedReaction) return topReactors;
    const myType = COSMIC_REACTIONS.find((r) => r.emoji === selectedReaction)?.type;
    return topReactors.filter((r) => r.id && r.type === myType);
  }, [topReactors, selectedReaction]);

  return (
    <div className="post-engagement">
      {totalReactions > 0 && (
        <ReactionSummaryLine
          total={totalReactions}
          myReaction={selectedReaction}
          reactionCounts={reactionCounts}
          topReactors={filteredTop}
          onOpen={postId ? () => setShowReactors(true) : undefined}
        />
      )}

      <div className="post-engagement__reactions-wrap">
        <PostReactions
          onReaction={onReaction}
          selectedReaction={selectedReaction}
          reactionCounts={reactionCounts}
          contentType={postId ? 'post' : undefined}
          contentId={postId}
        />
      </div>

      <div className="post-engagement__actions">
        <span className="post-engagement__stat" title={t('feed.views')}>
          <EyeIcon className="h-4 w-4 opacity-70" strokeWidth={1.75} />
          {views > 0 ? views.toLocaleString() : '—'}
        </span>

        <button
          type="button"
          onClick={onCommentsToggle}
          className={`post-engagement__chip${commentsOpen ? ' post-engagement__chip--active' : ''}`}
          aria-expanded={commentsOpen}
          aria-label={commentsOpen ? t('feed.hideComments') : t('feed.discuss')}
        >
          <ChatBubbleLeftRightIcon className="h-5 w-5" strokeWidth={1.75} />
          <span className="hidden sm:inline">
            {commentsOpen ? t('feed.hideComments') : t('feed.discuss')}
          </span>
          {commentsCount > 0 && (
            <span className="post-engagement__count" aria-label={`${commentsCount} comments`}>
              {commentsCount}
            </span>
          )}
        </button>

        {showRepost && (
          <div className="post-engagement__repost">
            <button
              type="button"
              onClick={() => setRepostMenu((v) => !v)}
              onBlur={() => setTimeout(() => setRepostMenu(false), 160)}
              className={`post-engagement__chip${reposted ? ' post-engagement__chip--active' : ''}`}
              aria-expanded={repostMenu}
              aria-haspopup="menu"
              aria-label={t('feed.repost')}
              title={t('feed.repost')}
            >
              <ArrowPathRoundedSquareIcon className="h-5 w-5" strokeWidth={1.75} />
              <span className="hidden sm:inline">{t('feed.repost')}</span>
              {repostsCount > 0 && (
                <span className="post-engagement__count">{repostsCount}</span>
              )}
            </button>
            {repostMenu && (
              <div className="post-engagement__repost-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setRepostMenu(false); onRepost?.(); }}
                  className="post-engagement__repost-item"
                >
                  <ArrowPathRoundedSquareIcon className="h-5 w-5" strokeWidth={1.75} />
                  {reposted ? t('feed.undoRepost') : t('feed.echo')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setRepostMenu(false); onQuote?.(); }}
                  className="post-engagement__repost-item"
                >
                  <PencilSquareIcon className="h-5 w-5" strokeWidth={1.75} />
                  {t('feed.quote')}
                </button>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onShare}
          className="post-engagement__chip post-engagement__chip--share"
          aria-label={t('feed.share')}
        >
          <ShareIcon className="h-5 w-5" strokeWidth={1.75} />
          <span className="hidden sm:inline">{t('feed.share')}</span>
          {sharesCount > 0 && (
            <span className="post-engagement__count">{sharesCount}</span>
          )}
        </button>
      </div>

      {postId ? (
        <ReactorsModal
          open={showReactors}
          onClose={() => setShowReactors(false)}
          contentType="post"
          contentId={postId}
          initialFilter={'all' as ReactionType | 'all'}
        />
      ) : null}
    </div>
  );
}
