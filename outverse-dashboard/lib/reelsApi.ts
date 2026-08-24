import { apiFetch } from './api';
import type { ReelDiscoverPayload } from './reelTypes';

/** Trending/featured/fresh/mood/tag lanes for the reels discover surfaces. Cached 180s server-side. */
export async function fetchReelsDiscover(): Promise<ReelDiscoverPayload | null> {
  try {
    const res = await apiFetch('reels/discover/');
    if (!res.ok) return null;
    return (await res.json()) as ReelDiscoverPayload;
  } catch {
    return null;
  }
}
