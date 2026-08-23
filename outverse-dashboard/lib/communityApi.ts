import { apiFetch, apiFetchJson } from './api';

export type Community = {
  id: number;
  slug: string;
  name: string;
  description: string;
  cover_url: string;
  privacy: 'public' | 'private';
  rules: string[];
  flair_options: string[];
  is_nsfw?: boolean;
  spoilers_enabled?: boolean;
  posting_permission?: 'members' | 'mods';
  creator_username: string;
  members_count: number;
  posts_count: number;
  created_at: string;
  is_member: boolean;
  is_moderator: boolean;
  is_pending: boolean;
  is_banned: boolean;
};

export type CommunityModQueueItem = {
  id: number;
  type: string;
  object_id: number;
  content: string;
  reporter: string;
  status: string;
  ai_flagged: boolean;
  created_at: string;
  post: {
    id: number;
    text: string;
    username: string;
    flair: string;
  } | null;
};

export type CommunityFeedSort = 'new' | 'top' | 'hot' | 'controversial';

export type CommunityMember = {
  id: number;
  username: string;
  is_moderator: boolean;
  is_creator: boolean;
  flair: string;
  joined_at: string;
};

export type CommunityPendingMember = {
  id: number;
  username: string;
  requested_at: string;
};

export type CommunityBannedMember = {
  id: number;
  username: string;
  banned_at: string;
};

export async function fetchCommunities(q?: string, ordering?: 'trending'): Promise<Community[]> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (ordering) params.set('ordering', ordering);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`communities/${qs}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

export async function fetchCommunitiesResult(
  q?: string,
  ordering?: 'trending',
): Promise<{ communities: Community[]; ok: boolean }> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (ordering) params.set('ordering', ordering);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`communities/${qs}`);
  if (!res.ok) return { communities: [], ok: false };
  const data = await res.json();
  return { communities: Array.isArray(data) ? data : data.results || [], ok: true };
}

export async function fetchMyCommunities(): Promise<Community[]> {
  const res = await apiFetch('communities/?mine=1');
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

export async function fetchCommunity(slug: string): Promise<Community | null> {
  const res = await apiFetch(`communities/${slug}/`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchCommunityResult(
  slug: string,
): Promise<{ community: Community | null; status: number }> {
  const res = await apiFetch(`communities/${slug}/`);
  if (!res.ok) return { community: null, status: res.status };
  return { community: await res.json(), status: res.status };
}

export type CommunityConstellationQuestion = {
  id: number | null;
  text: string;
  category?: string;
  placeholder?: boolean;
};

export type CommunityConstellation = {
  community_id: number;
  keywords: string[];
  questions: CommunityConstellationQuestion[];
  deep_links: { lab: string };
};

export async function fetchCommunityConstellation(slug: string): Promise<CommunityConstellation | null> {
  const res = await apiFetch(`communities/${slug}/constellation/`);
  if (!res.ok) return null;
  return res.json();
}

export type CommunityRitualPrompt = {
  id: number | null;
  text: string;
  category?: string;
  placeholder: boolean;
};

export type CommunityRitual = {
  available: boolean;
  prompt: CommunityRitualPrompt | null;
  date: string | null;
  completed: boolean;
  streak: number;
};

export async function fetchCommunityRitual(slug: string): Promise<CommunityRitual | null> {
  const res = await apiFetch(`communities/${slug}/ritual/`);
  if (!res.ok) return null;
  return res.json();
}

export async function completeCommunityRitual(slug: string): Promise<CommunityRitual | null> {
  const res = await apiFetchJson(`communities/${slug}/ritual/`, { method: 'POST', json: {} });
  if (!res.ok) return null;
  return res.json();
}

export async function createCommunity(
  name: string,
  description: string,
  privacy: 'public' | 'private' = 'public',
): Promise<Community | null> {
  const res = await apiFetchJson('communities/', {
    method: 'POST',
    json: { name, description, privacy },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function joinCommunity(slug: string): Promise<Community | null> {
  const res = await apiFetchJson(`communities/${slug}/join/`, { method: 'POST', json: {} });
  if (!res.ok) return null;
  return res.json();
}

export async function leaveCommunity(slug: string): Promise<Community | null> {
  const res = await apiFetchJson(`communities/${slug}/leave/`, { method: 'POST', json: {} });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchCommunityMembers(slug: string): Promise<CommunityMember[]> {
  const res = await apiFetch(`communities/${slug}/members/`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchPendingMembers(slug: string): Promise<CommunityPendingMember[]> {
  const res = await apiFetch(`communities/${slug}/pending-members/`);
  if (!res.ok) return [];
  return res.json();
}

export async function approveMember(slug: string, userId: number): Promise<boolean> {
  const res = await apiFetchJson(`communities/${slug}/approve/`, { method: 'POST', json: { user_id: userId } });
  return res.ok;
}

export async function rejectMember(slug: string, userId: number): Promise<boolean> {
  const res = await apiFetchJson(`communities/${slug}/reject/`, { method: 'POST', json: { user_id: userId } });
  return res.ok;
}

export async function kickMember(slug: string, userId: number): Promise<boolean> {
  const res = await apiFetchJson(`communities/${slug}/kick/`, { method: 'POST', json: { user_id: userId } });
  return res.ok;
}

export async function banMember(slug: string, userId: number): Promise<boolean> {
  const res = await apiFetchJson(`communities/${slug}/ban/`, { method: 'POST', json: { user_id: userId } });
  return res.ok;
}

export async function unbanMember(slug: string, userId: number): Promise<boolean> {
  const res = await apiFetchJson(`communities/${slug}/unban/`, { method: 'POST', json: { user_id: userId } });
  return res.ok;
}

export async function fetchBannedMembers(slug: string): Promise<CommunityBannedMember[]> {
  const res = await apiFetch(`communities/${slug}/banned-members/`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchModQueue(slug: string): Promise<CommunityModQueueItem[]> {
  const res = await apiFetch(`communities/${slug}/mod-queue/`);
  if (!res.ok) return [];
  return res.json();
}

export async function resolveModQueueItem(
  slug: string,
  flagId: number,
  action: 'approve' | 'remove' | 'ban',
): Promise<boolean> {
  const res = await apiFetchJson(`communities/${slug}/mod-resolve/`, {
    method: 'POST',
    json: { flag_id: flagId, action },
  });
  return res.ok;
}

export async function updateCommunityGates(
  slug: string,
  payload: {
    is_nsfw?: boolean;
    spoilers_enabled?: boolean;
    posting_permission?: 'members' | 'mods';
    flair_options?: string[];
    cover_url?: string;
  },
): Promise<Community | null> {
  const res = await apiFetchJson(`communities/${slug}/`, {
    method: 'PATCH',
    json: payload,
  });
  if (!res.ok) return null;
  return res.json();
}

export async function pinCommunityPost(postId: number): Promise<{
  is_community_pinned?: boolean;
  error?: string;
} | null> {
  const res = await apiFetchJson(`posts/${postId}/pin-community/`, {
    method: 'POST',
    json: {},
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data?.error || 'Could not anchor signal.' };
  return data;
}

export async function crossEchoPost(
  postId: number,
  communityId: number,
  opts?: { text?: string; flair?: string; is_spoiler?: boolean },
): Promise<boolean> {
  const res = await apiFetchJson(`posts/${postId}/cross-echo/`, {
    method: 'POST',
    json: {
      community_id: communityId,
      text: opts?.text || '',
      ...(opts?.flair ? { flair: opts.flair } : {}),
      ...(opts?.is_spoiler ? { is_spoiler: true } : {}),
    },
  });
  return res.ok;
}

export async function fetchCommunityPosts(
  slug: string,
  sort: CommunityFeedSort = 'new',
): Promise<unknown[]> {
  const res = await apiFetch(
    `posts/?feed=community&community=${encodeURIComponent(slug)}&sort=${sort}`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

export async function setModerator(slug: string, userId: number, isModerator: boolean): Promise<boolean> {
  const res = await apiFetchJson(`communities/${slug}/set-moderator/`, {
    method: 'POST',
    json: { user_id: userId, is_moderator: isModerator },
  });
  return res.ok;
}

export async function updateCommunityRules(slug: string, rules: string[]): Promise<Community | null> {
  const res = await apiFetchJson(`communities/${slug}/`, {
    method: 'PATCH',
    json: { rules },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function createCommunityPost(
  communityId: number,
  text: string,
  flair?: string,
  isSpoiler?: boolean,
): Promise<boolean> {
  const res = await apiFetchJson('posts/', {
    method: 'POST',
    json: {
      text: text.trim(),
      post_type: 'normal',
      community_id: communityId,
      ...(flair ? { flair } : {}),
      ...(isSpoiler ? { is_spoiler: true } : {}),
    },
  });
  return res.ok;
}

export type CommunityChannel = {
  id: number;
  name: string;
  category: string;
  slowmode_seconds: number;
  channel_type?: 'text' | 'voice' | 'stage';
  unread_count?: number;
  created_at: string;
};

export type CommunityWikiPage = {
  id: number;
  slug: string;
  title: string;
  body: string;
  edited_at: string | null;
  edited_by: string | null;
};

export async function fetchCommunityChannels(slug: string): Promise<CommunityChannel[]> {
  const res = await apiFetch(`communities/${slug}/channels/`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function createCommunityChannel(
  slug: string,
  payload: { name: string; category?: string; slowmode_seconds?: number; channel_type?: 'text' | 'voice' | 'stage' },
): Promise<CommunityChannel | null> {
  const res = await apiFetchJson(`communities/${slug}/channels/`, {
    method: 'POST',
    json: payload,
  });
  if (!res.ok) return null;
  return (await res.json()) as CommunityChannel;
}

export async function updateCommunityChannel(
  slug: string,
  id: number | string,
  payload: {
    name?: string;
    category?: string;
    slowmode_seconds?: number;
    channel_type?: 'text' | 'voice' | 'stage';
  },
): Promise<CommunityChannel | null> {
  const res = await apiFetchJson(`communities/${slug}/channels/${id}/`, {
    method: 'PATCH',
    json: payload,
  });
  if (!res.ok) return null;
  return (await res.json()) as CommunityChannel;
}

export async function deleteCommunityChannel(slug: string, id: number | string): Promise<boolean> {
  const res = await apiFetch(`communities/${slug}/channels/${id}/`, { method: 'DELETE' });
  return res.ok;
}

export async function joinCommunityChannel(
  slug: string,
  channelId: number | string,
): Promise<CommunityChannel | null> {
  const res = await apiFetchJson(`communities/${slug}/channels/${channelId}/join/`, {
    method: 'POST',
    json: {},
  });
  if (!res.ok) return null;
  return (await res.json()) as CommunityChannel;
}

export async function fetchCommunityWiki(slug: string): Promise<CommunityWikiPage[]> {
  const res = await apiFetch(`communities/${slug}/wiki/`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchCommunityWikiPage(
  slug: string,
  pageSlug: string,
): Promise<CommunityWikiPage | null> {
  const res = await apiFetch(
    `communities/${encodeURIComponent(slug)}/wiki/${encodeURIComponent(pageSlug)}/`,
  );
  if (!res.ok) return null;
  return (await res.json()) as CommunityWikiPage;
}

export async function createOrUpdateWikiPage(
  slug: string,
  payload: { title: string; body: string; slug?: string },
): Promise<CommunityWikiPage | null> {
  const res = await apiFetchJson(`communities/${encodeURIComponent(slug)}/wiki/`, {
    method: 'POST',
    json: payload,
  });
  if (!res.ok) return null;
  return (await res.json()) as CommunityWikiPage;
}
