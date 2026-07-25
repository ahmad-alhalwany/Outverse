import { apiFetchJson } from './api';

export type YearInReview = {
  year: number;
  posts_count: number;
  words_written: number;
  longest_post_chars: number;
  first_post: { id: number; text: string; created_at: string } | null;
  top_tags: { tag: string; count: number }[];
  top_categories: { category: string; count: number }[];
  capsules_created: number;
  capsules_opened: number;
  rooms_joined: number;
  ritual_days: number;
  ritual_max_streak: number;
  voice_notes: number;
  username: string;
  display_name: string;
};

export async function fetchYearInReview(year?: number): Promise<YearInReview | null> {
  const qs = year ? `?year=${year}` : '';
  const res = await apiFetchJson(`users/me/year/${qs}`, { method: 'GET' });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}
