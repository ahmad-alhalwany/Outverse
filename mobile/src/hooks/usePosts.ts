import { useState, useCallback, useEffect } from 'react';
import api from '../api/client';
import type { Post } from '../types';
import type { ReactionType } from '../lib/reactions';

interface UsePostsOptions {
  limit?: number;
  ordering?: string;
  author?: string | number;
  feed?: string;
}

export function usePosts(options: UsePostsOptions = {}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const limit = options.limit || 10;

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPosts({
        offset: 0,
        limit,
        ordering: options.ordering,
        author: options.author,
        feed: options.feed,
      });
      setPosts(data.results || []);
      setHasMore(!!data.has_more);
      setOffset(data.results?.length || 0);
    } catch (e: any) {
      setError(e?.message || 'فشل تحميل المنشورات');
    } finally {
      setLoading(false);
    }
  }, [limit, options.ordering, options.author, options.feed]);

  const loadMore = useCallback(async () => {
    if (loading || refreshing || !hasMore) return;
    try {
      const data = await api.getPosts({
        offset,
        limit,
        ordering: options.ordering,
        author: options.author,
        feed: options.feed,
      });
      setPosts((prev) => [...prev, ...(data.results || [])]);
      setHasMore(!!data.has_more);
      setOffset((prev) => prev + (data.results?.length || 0));
    } catch (e: any) {
      setError(e?.message || 'فشل تحميل المزيد');
    }
  }, [offset, loading, refreshing, hasMore, limit, options.ordering, options.author, options.feed]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitial();
    setRefreshing(false);
  }, [loadInitial]);

  const react = useCallback((postId: string | number, type: ReactionType) => {
    const current = posts.find((p) => String(p.id) === String(postId));
    const wasSameReaction = current?.my_reaction === type;
    setPosts((prev) =>
      prev.map((p) =>
        String(p.id) === String(postId)
          ? {
              ...p,
              my_reaction: wasSameReaction ? null : type,
              likes_count: wasSameReaction
                ? Math.max(0, p.likes_count - 1)
                : p.likes_count + (current?.my_reaction ? 0 : 1),
            }
          : p,
      ),
    );
    api
      .reactToPost(postId, wasSameReaction ? null : type)
      .then((data) => {
        setPosts((prev) =>
          prev.map((p) =>
            String(p.id) === String(postId)
              ? {
                  ...p,
                  my_reaction: data.my_reaction,
                  likes_count: data.total,
                  reaction_counts: data.reaction_counts,
                }
              : p,
          ),
        );
      })
      .catch(() => {
        setPosts((prev) => prev.map((p) => (String(p.id) === String(postId) && current ? current : p)));
      });
  }, [posts]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  return { posts, setPosts, loading, error, hasMore, refreshing, loadMore, refresh, react };
}
