'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { getUser } from '@/lib/auth';
import type { ReelItem } from '@/lib/reelTypes';
import type { ReactionType } from '@/lib/reactions';
import ReelSlide from './ReelSlide';
import ReelsFeedProgress from './ReelsFeedProgress';
import FeedUndoToast from '../FeedUndoToast';
import ErrorState from '../ui/ErrorState';
import { useLocale } from '../LocaleProvider';

interface ReelsFeedProps {
  feed: 'all' | 'following';
  tag?: string | null;
  focusId?: number | null;
}

export default function ReelsFeed({ feed, tag, focusId }: ReelsFeedProps) {
  const { t } = useLocale();
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [reactionError, setReactionError] = useState('');
  const [dimUndoId, setDimUndoId] = useState<number | null>(null);
  const [dimBusy, setDimBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (feed === 'following') params.set('feed', 'following');
      if (tag) params.set('tag', tag);
      const qs = params.toString();
      const res = await apiFetch(`reels/${qs ? `?${qs}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.results || [];
        setReels(list);
        if (focusId) {
          const idx = list.findIndex((r: ReelItem) => r.id === focusId);
          setActiveIdx(idx >= 0 ? idx : 0);
        } else {
          setActiveIdx(0);
        }
      } else {
        setReels([]);
        setError(true);
      }
    } catch {
      setReels([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [feed, tag, focusId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.55) return;
          const idx = slideRefs.current.findIndex((el) => el === entry.target);
          if (idx >= 0) setActiveIdx(idx);
        });
      },
      { root, threshold: [0.55, 0.75] },
    );

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [reels.length]);

  const handleLike = async (id: number, reaction: ReactionType = 'spark') => {
    if (!getUser()) {
      setReactionError(t('reels.reactionError'));
      return null;
    }
    try {
      const res = await apiFetchJson(`reels/${id}/react/`, {
        method: 'POST',
        json: { reaction },
      });
      if (res.ok) {
        setReactionError('');
        return (await res.json()) as {
          liked: boolean;
          likes_count: number;
          reaction_counts?: Record<string, number>;
          my_reaction?: ReactionType | null;
        };
      }
      setReactionError(t('reels.reactionError'));
    } catch {
      setReactionError(t('reels.reactionError'));
    }
    return null;
  };

  const handleSavedChange = (id: number, saved: boolean) => {
    setReels((prev) => prev.map((reel) => (reel.id === id ? { ...reel, is_saved: saved } : reel)));
  };

  const handleDimmed = (id: number) => {
    setDimUndoId(id);
    setReels((prev) => prev.filter((reel) => reel.id !== id));
  };

  const undoDim = async () => {
    if (dimUndoId == null || dimBusy) return;
    setDimBusy(true);
    try {
      const res = await apiFetchJson(`reels/${dimUndoId}/dim/`, { method: 'POST' });
      if (res.ok) {
        setDimUndoId(null);
        await load();
      }
    } catch {
      /* keep toast so user can retry */
    } finally {
      setDimBusy(false);
    }
  };

  const dismissDimUndo = () => {
    setDimUndoId(null);
  };

  const handleView = async (id: number) => {
    try {
      await apiFetch(`reels/${id}/record_view/`, { method: 'POST' });
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!reactionError) return;
    const timer = setTimeout(() => setReactionError(''), 3000);
    return () => clearTimeout(timer);
  }, [reactionError]);

  if (loading) {
    return (
      <div className="reels-feed reels-feed--loading">
        <div className="reels-feed__loader">
          <span className="reels-feed__orb" />
          <p>{t('reels.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reels-feed reels-feed--empty">
        <ErrorState message={t('reels.loadError')} retryLabel={t('reels.retry')} onRetry={() => void load()} />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="reels-feed reels-feed--empty">
        <p className="reels-feed__empty-icon" aria-hidden>
          <span className="reels-feed__orb reels-feed__orb--small" />
        </p>
        <p>{t('reels.emptyTitle')}</p>
        <p className="text-sm opacity-70 mt-2">{t('reels.emptyHint')}</p>
        {dimUndoId != null && (
          <FeedUndoToast
            message={t('reels.dimmed')}
            undoLabel={t('social.undoFeedback')}
            busy={dimBusy}
            onUndo={() => void undoDim()}
            onDismiss={dismissDimUndo}
          />
        )}
      </div>
    );
  }

  return (
    <div className="reels-feed-wrap">
      {reactionError && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 rounded-full bg-black/80 px-4 py-2 text-xs font-medium text-white">
          {reactionError}
        </div>
      )}
      <ReelsFeedProgress total={reels.length} activeIndex={activeIdx} />
      <div ref={containerRef} className="reels-feed">
        {reels.map((reel, i) => {
          const isActive = i === activeIdx;
          return (
            <div
              key={reel.id}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              className="reels-feed__snap"
            >
              {isActive || i === activeIdx + 1 || i === activeIdx - 1 ? (
                <ReelSlide
                  reel={reel}
                  active={isActive}
                  onLike={handleLike}
                  onView={handleView}
                  onDeleted={load}
                  onSavedChange={handleSavedChange}
                  onDimmed={handleDimmed}
                />
              ) : (
                <div className="reels-feed__placeholder" />
              )}
            </div>
          );
        })}
      </div>
      {dimUndoId != null && (
        <FeedUndoToast
          message={t('reels.dimmed')}
          undoLabel={t('social.undoFeedback')}
          busy={dimBusy}
          onUndo={() => void undoDim()}
          onDismiss={dismissDimUndo}
        />
      )}
    </div>
  );
}
