import { useState, useCallback, useEffect } from 'react';
import api from '../api/client';
import type { Reel, ReelComment } from '../types';
import type { ReactionType } from '@/lib/reactions';

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

  const like = useCallback((reelId: string, type: ReactionType = 'spark') => {
    const current = reels.find((r) => String(r.id) === String(reelId));
    const wasSame = current?.my_reaction === type;
    const next = wasSame ? null : type;
    setReels((prev) =>
      prev.map((r) =>
        String(r.id) === String(reelId)
          ? {
              ...r,
              is_liked: !!next,
              my_reaction: next,
              likes_count: wasSame
                ? Math.max(0, r.likes_count - 1)
                : r.likes_count + (current?.my_reaction ? 0 : 1),
            }
          : r
      )
    );
    api.reactToReel(reelId, next).then((data) => {
      setReels((prev) =>
        prev.map((r) =>
          String(r.id) === String(reelId)
            ? {
                ...r,
                my_reaction: data.my_reaction,
                is_liked: !!data.my_reaction,
                reaction_counts: data.reaction_counts || r.reaction_counts,
              }
            : r
        )
      );
    }).catch(() => {
      if (current) {
        setReels((prev) => prev.map((r) => (String(r.id) === String(reelId) ? current : r)));
      }
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
