import { useState, useCallback, useEffect } from 'react';
import api from '../api/client';
import type { Story, PaginatedResponse } from '../types';

export function useStories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.request('get', '/stories/');
      const data = res as PaginatedResponse<Story> | Story[];
      const items = Array.isArray(data) ? data : data.results || [];
      setStories(items);
    } catch {
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const viewStory = useCallback(async (storyId: string | number) => {
    try {
      await api.viewStory(storyId);
    } catch {
      // ignore
    }
  }, []);

  const createStory = useCallback(async (formData: FormData) => {
    try {
      await api.createStory(formData);
      await load();
    } catch (e) {
      console.error('Failed to create story', e);
      throw e;
    }
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  return { stories, loading, load, viewStory, createStory };
}
