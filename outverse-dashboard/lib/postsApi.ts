import { apiFetch, apiFetchJson } from './api';
import { mapPost, type ApiPost, type MappedPost } from '@/utils/postMapper';

export interface RepostResult {
  reposted?: boolean;
  reposts_count?: number;
  post?: MappedPost | null;
  /** For a quote, the API returns the new post directly. */
  quote?: MappedPost | null;
}

/**
 * Echo (pure repost) or Quote a post.
 * - Pass no text → toggles a pure echo (repost).
 * - Pass text → creates a quote post.
 */
export async function repostPost(
  postId: number,
  text?: string,
): Promise<RepostResult | null> {
  try {
    const trimmed = (text || '').trim();
    const res = await apiFetchJson(`posts/${postId}/repost/`, {
      method: 'POST',
      json: trimmed ? { text: trimmed } : {},
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Quote returns a full post object; echo returns {reposted, reposts_count, post?}.
    if (trimmed) {
      return { quote: mapPost(data as ApiPost), reposted: true };
    }
    return {
      reposted: !!data.reposted,
      reposts_count: data.reposts_count,
      post: data.post ? mapPost(data.post as ApiPost) : null,
    };
  } catch {
    return null;
  }
}

export interface SavedCollection {
  id: number;
  name: string;
  description?: string;
  is_public?: boolean;
  cover_url?: string;
  item_count: number;
  created_at: string;
}

/** List the current user's saved-post folders. */
export async function fetchCollections(): Promise<SavedCollection[]> {
  try {
    const res = await apiFetch('collections/');
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data?.results || [];
  } catch {
    return [];
  }
}

/** Create (or fetch existing) a named folder. */
export async function createCollection(name: string, isPublic = false): Promise<SavedCollection | null> {
  try {
    const res = await apiFetchJson('collections/', {
      method: 'POST',
      json: { name: name.trim(), is_public: isPublic },
    });
    if (!res.ok) return null;
    return (await res.json()) as SavedCollection;
  } catch {
    return null;
  }
}

export async function updateCollection(
  collectionId: number,
  payload: Partial<Pick<SavedCollection, 'name' | 'description' | 'is_public'>>,
): Promise<SavedCollection | null> {
  try {
    const res = await apiFetchJson(`collections/${collectionId}/`, {
      method: 'PATCH',
      json: payload,
    });
    if (!res.ok) return null;
    return (await res.json()) as SavedCollection;
  } catch {
    return null;
  }
}

/** Toggle save, optionally into a folder (moves if already saved elsewhere). */
export async function saveToCollection(
  postId: number,
  collectionId?: number,
): Promise<{ saved: boolean; collection?: number | null } | null> {
  try {
    const res = await apiFetchJson(`posts/${postId}/toggle_save/`, {
      method: 'POST',
      json: collectionId ? { collection: collectionId } : {},
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Fetch edit history snapshots for a post. */
export async function fetchPostEdits(
  postId: number,
): Promise<{ id: number; previous_text: string; edited_at: string }[]> {
  try {
    const res = await apiFetch(`posts/${postId}/edits/`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export type FeedPage = {
  results: ApiPost[];
  count: number;
  has_more: boolean;
};

export type HomeFeed = 'for_you' | 'following' | 'discover' | 'joined';

/** Paginated feed fetch (limit/offset envelope). */
export async function fetchFeedPage(opts: {
  feed?: HomeFeed | 'all';
  limit?: number;
  offset?: number;
}): Promise<FeedPage | null> {
  try {
    const params = new URLSearchParams();
    params.set('limit', String(opts.limit ?? 10));
    params.set('offset', String(opts.offset ?? 0));
    const feed = opts.feed === 'all' ? 'for_you' : (opts.feed ?? 'for_you');
    if (feed === 'following') params.set('feed', 'following');
    else if (feed === 'discover') params.set('feed', 'discover');
    else if (feed === 'joined') params.set('feed', 'joined');
    else params.set('feed', 'for_you');
    const res = await apiFetch(`posts/?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const raw: ApiPost[] = Array.isArray(data) ? data : data.results || [];
    return {
      results: raw,
      count: Array.isArray(data) ? raw.length : (data.count ?? raw.length),
      has_more: Array.isArray(data) ? false : !!data.has_more,
    };
  } catch {
    return null;
  }
}

/** Fetch the full ordered thread chain a post belongs to. */
export async function fetchThread(postId: number): Promise<MappedPost[]> {
  try {
    const res = await apiFetch(`posts/${postId}/thread/`);
    if (!res.ok) return [];
    const data = await res.json();
    const list: ApiPost[] = Array.isArray(data) ? data : data?.results || [];
    return list.map(mapPost);
  } catch {
    return [];
  }
}

/** Toggle pinned signal on the caller's profile (max 3). */
export async function pinProfilePost(
  postId: number,
): Promise<{ is_profile_pinned: boolean; profile_pinned_at?: string | null; error?: string } | null> {
  try {
    const res = await apiFetchJson(`posts/${postId}/pin-profile/`, {
      method: 'POST',
      json: {},
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { is_profile_pinned: false, error: data?.error || 'Could not pin signal.' };
    }
    return {
      is_profile_pinned: !!data.is_profile_pinned,
      profile_pinned_at: data.profile_pinned_at ?? null,
    };
  } catch {
    return null;
  }
}

export type OrbitListMember = {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  added_at?: string;
};

export type OrbitList = {
  id: number;
  title: string;
  description?: string;
  is_private: boolean;
  member_count: number;
  is_following?: boolean;
  members?: OrbitListMember[];
  owner?: { id?: number; username?: string };
  created_at?: string;
  updated_at?: string;
};

export async function fetchOrbitLists(mode: 'mine' | 'following' | 'discover' = 'mine'): Promise<OrbitList[]> {
  try {
    const q = mode === 'mine' ? '' : `?${mode}=1`;
    const res = await apiFetch(`orbit-lists/${q}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data?.results || [];
  } catch {
    return [];
  }
}

export async function toggleFollowOrbitList(listId: number): Promise<{ following: boolean | null; error?: string }> {
  try {
    const res = await apiFetchJson(`orbit-lists/${listId}/follow/`, { method: 'POST' });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { following: null, error: data?.error || data?.detail };
    return { following: Boolean(data?.following) };
  } catch {
    return { following: null };
  }
}

export async function createOrbitList(payload: {
  title: string;
  description?: string;
  is_private?: boolean;
}): Promise<OrbitList | null> {
  try {
    const res = await apiFetchJson('orbit-lists/', {
      method: 'POST',
      json: payload,
    });
    if (!res.ok) return null;
    return (await res.json()) as OrbitList;
  } catch {
    return null;
  }
}

export async function fetchOrbitList(id: number): Promise<OrbitList | null> {
  try {
    const res = await apiFetch(`orbit-lists/${id}/`);
    if (!res.ok) return null;
    return (await res.json()) as OrbitList;
  } catch {
    return null;
  }
}

export async function addOrbitListMember(
  listId: number,
  userId: number,
): Promise<{ list: OrbitList | null; error?: string }> {
  try {
    const res = await apiFetchJson(`orbit-lists/${listId}/members/`, {
      method: 'POST',
      json: { user_id: userId },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { list: null, error: data?.error || data?.detail };
    return { list: data as OrbitList };
  } catch {
    return { list: null };
  }
}

export async function removeOrbitListMember(
  listId: number,
  userId: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await apiFetch(`orbit-lists/${listId}/members/${userId}/`, {
      method: 'DELETE',
    });
    if (res.ok || res.status === 204) return { ok: true };
    const data = await res.json().catch(() => null);
    return { ok: false, error: data?.error || data?.detail };
  } catch {
    return { ok: false };
  }
}

export async function deleteOrbitList(listId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await apiFetch(`orbit-lists/${listId}/`, { method: 'DELETE' });
    if (res.ok || res.status === 204) return { ok: true };
    const data = await res.json().catch(() => null);
    return { ok: false, error: data?.error || data?.detail };
  } catch {
    return { ok: false };
  }
}

export async function fetchOrbitListFeed(
  listId: number,
  opts?: { limit?: number; offset?: number },
): Promise<FeedPage | null> {
  try {
    const params = new URLSearchParams();
    params.set('limit', String(opts?.limit ?? 20));
    params.set('offset', String(opts?.offset ?? 0));
    const res = await apiFetch(`orbit-lists/${listId}/feed/?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      results: data.results || [],
      count: data.count ?? 0,
      has_more: !!data.has_more,
    };
  } catch {
    return null;
  }
}
