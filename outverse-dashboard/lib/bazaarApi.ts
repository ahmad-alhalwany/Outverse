import { apiFetchJson } from './api';
import type { BazaarIdea } from './bazaarTypes';

export async function toggleIdeaSave(ideaId: number): Promise<{ saved: boolean } | null> {
  try {
    const res = await apiFetchJson(`ideas/${ideaId}/toggle-save/`, { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json();
    return { saved: !!(data.saved ?? data.is_saved) };
  } catch {
    return null;
  }
}

export async function fetchIdeas(params: {
  ordering?: string;
  category?: string;
  owner?: 'me' | 'collaborating' | 'supporting';
  owner_id?: string;
  tag?: string;
  page?: number;
}): Promise<{ results: BazaarIdea[]; hasMore: boolean }> {
  const search = new URLSearchParams();
  if (params.ordering) search.set('ordering', params.ordering);
  if (params.category && params.category !== 'all') search.set('category', params.category);
  if (params.owner) search.set('owner', params.owner);
  if (params.owner_id) search.set('owner_id', params.owner_id);
  if (params.tag) search.set('tag', params.tag);
  if (params.page) search.set('page', String(params.page));

  const qs = search.toString();
  const res = await apiFetchJson(`ideas/${qs ? `?${qs}` : ''}`);
  if (!res.ok) return { results: [], hasMore: false };
  const data = await res.json();
  if (Array.isArray(data)) return { results: data, hasMore: false };
  return {
    results: data.results || [],
    hasMore: !!data.next,
  };
}
