import { useState, useCallback, useEffect } from 'react';
import api from '../api/client';
import type { Reel, ReelComment } from '../types';

export type ReelsFeedMode = 'all' | 'following';

export function useReels(feed: ReelsFeedMode = 'all') {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getReels({
        offset: 0,
        limit: 20,
        feed: feed === 'following' ? 'following' : 'all',
      });
      setReels(data.results || []);
      setCurrentIndex(0);
    } catch (e: any) {
      setError(e?.message || 'Failed to load reels');
    } finally {
      setLoading(false);
    }
  }, [feed]);

  const like = useCallback((reelId: string) => {
    const wasReacted = reels.find((r) => String(r.id) === String(reelId))?.my_reaction === 'spark';
    setReels((prev) =>
      prev.map((r) =>
        String(r.id) === String(reelId)
          ? {
              ...r,
              is_liked: !wasReacted,
              my_reaction: wasReacted ? null : 'spark',
              likes_count: wasReacted ? r.likes_count - 1 : r.likes_count + 1,
            }
          : r
      )
    );
    api.reactToReel(reelId, wasReacted ? null : 'spark').catch(() => {
      setReels((prev) =>
        prev.map((r) =>
          String(r.id) === String(reelId)
            ? {
                ...r,
                is_liked: wasReacted,
                my_reaction: wasReacted ? 'spark' : null,
                likes_count: wasReacted ? r.likes_count + 1 : r.likes_count - 1,
              }
            : r
        )
      );
    });
  }, [reels]);

  const toggleSave = useCallback(async (reelId: string) => {
    try {
      const data = await api.saveReel(reelId);
      setReels((prev) =>
        prev.map((r) => (String(r.id) === String(reelId) ? { ...r, is_saved: data.saved } : r))
      );
      return data.saved;
    } catch {
      return null;
    }
  }, []);

  const dimReel = useCallback(async (reelId: string) => {
    try {
      const data = await api.dimReel(reelId);
      if (data.dimmed) {
        setReels((prev) => prev.filter((r) => String(r.id) !== String(reelId)));
      }
      return data.dimmed;
    } catch {
      return null;
    }
  }, []);

  const viewReel = useCallback(async (reelId: string) => {
    try {
      await api.recordReelView(reelId);
    } catch {
      // ignore view errors
    }
  }, []);

  const loadComments = useCallback(async (reelId: string) => {
    const data = await api.getReelComments(reelId);
    return (data.results || []) as ReelComment[];
  }, []);

  const addComment = useCallback(async (reelId: string, text: string) => {
    const comment = (await api.createReelComment(reelId, text)) as ReelComment;
    setReels((prev) =>
      prev.map((r) =>
        String(r.id) === String(reelId)
          ? { ...r, comments_count: r.comments_count + 1 }
          : r
      )
    );
    return comment;
  }, []);

  const shareReel = useCallback(async (reelId: string) => {
    try {
      const result = await api.shareReel(reelId, 'other');
      setReels((prev) =>
        prev.map((r) =>
          String(r.id) === String(reelId)
            ? { ...r, shares_count: result.shares_count }
            : r
        )
      );
      return result;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    reels,
    loading,
    error,
    currentIndex,
    setCurrentIndex,
    load,
    like,
    toggleSave,
    dimReel,
    viewReel,
    loadComments,
    addComment,
    shareReel,
  };
}
