import { apiFetchJson } from './api';
import type { ReactionType } from './reactions';

export type ReactorRow = {
  user: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
    avatar?: string | null;
  };
  type: ReactionType;
  created_at: string;
};

export type ReactorsResponse = {
  results: ReactorRow[];
  count: number;
  reaction_counts: Record<string, number>;
};

export type ReactionContentType = 'post' | 'reel' | 'story';

export async function fetchReactors(
  contentType: ReactionContentType,
  id: number,
  type?: ReactionType,
): Promise<ReactorsResponse | null> {
  const base =
    contentType === 'post'
      ? `posts/${id}/reactors/`
      : contentType === 'reel'
        ? `reels/${id}/reactors/`
        : `stories/${id}/reactors/`;
  const qs = type ? `?type=${encodeURIComponent(type)}` : '';
  try {
    const res = await apiFetchJson(`${base}${qs}`, { method: 'GET' });
    if (!res.ok) return null;
    return res.json().catch(() => null);
  } catch {
    return null;
  }
}

export async function reactToReel(
  id: number,
  reaction: ReactionType,
): Promise<{
  liked: boolean;
  likes_count: number;
  reaction_counts?: Record<string, number>;
  my_reaction?: ReactionType | null;
} | null> {
  try {
    const res = await apiFetchJson(`reels/${id}/react/`, {
      method: 'POST',
      json: { reaction },
    });
    if (!res.ok) return null;
    return res.json().catch(() => null);
  } catch {
    return null;
  }
}
