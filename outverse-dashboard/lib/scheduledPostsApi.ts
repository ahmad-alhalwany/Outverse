import { apiFetch, apiFetchJson } from './api';
import { consume } from './rateLimit';
import { getToken } from './auth';

export type ScheduledPostPayload = {
  text: string;
  mood?: string;
  tags?: string[];
  visibility?: 'public' | 'followers' | 'subscribers';
  required_tier_id?: number | null;
  location_name?: string;
  location_lat?: number;
  location_lng?: number;
};

export type ScheduledPost = {
  id: number;
  payload: ScheduledPostPayload;
  publish_at: string;
  status: 'pending' | 'published' | 'failed' | 'canceled';
  published_post_id: number | null;
  error: string;
  created_at: string;
};

/** List the current user's scheduled posts, soonest first. */
export async function fetchScheduledPosts(): Promise<ScheduledPost[]> {
  const res = await apiFetchJson('scheduled-posts/', { method: 'GET' });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const list = Array.isArray(data) ? data : data?.results;
  return Array.isArray(list) ? (list as ScheduledPost[]) : [];
}

/** Queue a post to publish at a future time. Returns null (with the response's
 * error payload accessible via the caller) if validation fails. */
export async function createScheduledPost(
  payload: ScheduledPostPayload,
  publishAt: string,
): Promise<{ ok: true; data: ScheduledPost } | { ok: false; error: string }> {
  consume('scheduledPostCreate', getToken() ?? 'anon');
  const res = await apiFetchJson('scheduled-posts/', {
    method: 'POST',
    json: { payload, publish_at: publishAt },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const firstError = Object.values(data || {})[0];
    const message = Array.isArray(firstError) ? firstError[0] : data?.detail || 'Could not schedule this post.';
    return { ok: false, error: String(message) };
  }
  return { ok: true, data: data as ScheduledPost };
}

/** Cancel a pending scheduled post. */
export async function cancelScheduledPost(id: number): Promise<boolean> {
  const res = await apiFetchJson(`scheduled-posts/${id}/`, { method: 'DELETE' });
  return res.ok;
}

/** Attach media to a pending scheduled post. */
export async function addScheduledMedia(
  id: number,
  files: Array<{ file: File; altText?: string }>,
): Promise<boolean> {
  if (files.length === 0) return true;
  const form = new FormData();
  files.forEach(({ file, altText }) => {
    form.append('media', file);
    if (altText?.trim()) form.append('alt_text', altText.trim());
  });
  const res = await apiFetch(`scheduled-posts/${id}/add_media/`, { method: 'POST', body: form });
  return res.ok;
}
