import { apiFetchJson } from '@/lib/api';

export type InspirationQuestion = {
  id: number;
  text: string;
  category: string;
  category_label: string;
  language: 'en' | 'ar';
  tags: string[];
};

const CACHE_KEY = 'cosmory-inspiration-cache';
const MAX_CACHE = 8;

type CacheEntry = {
  q: InspirationQuestion;
  at: number;
};

function readCache(): CacheEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCache(entries: CacheEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries.slice(0, MAX_CACHE)));
  } catch {
    /* ignore */
  }
}

/** Fetch the next unseen question for the user (or random if anonymous). */
export async function fetchNextQuestion(opts?: {
  lang?: 'en' | 'ar';
  category?: string;
  personalize?: boolean;
}): Promise<InspirationQuestion | null> {
  const params = new URLSearchParams();
  params.set('lang', opts?.lang ?? 'en');
  if (opts?.category && opts.category !== 'all') params.set('category', opts.category);
  if (opts?.personalize) params.set('personalize', '1');

  const res = await apiFetchJson(`questions/next/?${params.toString()}`, {
    method: 'GET',
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data || typeof data.id !== 'number') return null;
  return data as InspirationQuestion;
}

/** Generate a fresh AI prompt. Falls back to a bank question if no provider is set. */
export async function generateQuestion(opts?: {
  lang?: 'en' | 'ar';
  category?: string;
}): Promise<InspirationQuestion | null> {
  const params = new URLSearchParams();
  params.set('lang', opts?.lang ?? 'en');
  if (opts?.category && opts.category !== 'all') params.set('category', opts.category);

  const res = await apiFetchJson(`questions/generate/?${params.toString()}`, {
    method: 'POST',
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data || typeof data.id !== 'number') return null;
  return data as InspirationQuestion;
}

/** Mark a question as answered (user published a post inspired by it). */
export async function markQuestionAnswered(id: number): Promise<void> {
  try {
    await apiFetchJson(`questions/${id}/answer/`, { method: 'POST' });
  } catch {
    /* best-effort */
  }
}

/** Record that the user skipped this prompt — improves personalization. */
export async function skipQuestion(id: number): Promise<void> {
  try {
    await apiFetchJson(`questions/${id}/skip/`, { method: 'POST' });
  } catch {
    /* best-effort */
  }
}

export type InspirationStats = {
  answered_by_category: Record<string, number>;
  skipped_by_category: Record<string, number>;
  preferred_categories: string[];
  interests: string[];
};

export async function fetchInspirationStats(): Promise<InspirationStats | null> {
  const res = await apiFetchJson('questions/stats/', { method: 'GET' });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export type InspirationHistoryItem = {
  question: InspirationQuestion;
  viewed_at: string;
  answered: boolean;
  skipped: boolean;
  published: boolean;
};

export async function fetchInspirationHistory(): Promise<InspirationHistoryItem[]> {
  const res = await apiFetchJson('questions/history/', { method: 'GET' });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return Array.isArray(data?.results) ? data.results : [];
}

export type AnsweredByUser = {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
  answered_at: string;
};

/** List users who answered a question — powers "people who answered this". */
export async function fetchAnsweredBy(questionId: number): Promise<AnsweredByUser[]> {
  const res = await apiFetchJson(`questions/${questionId}/answered-by/`, { method: 'GET' });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return Array.isArray(data?.users) ? (data.users as AnsweredByUser[]) : [];
}

export async function suggestQuestion(opts: {
  text: string;
  category?: string;
  lang?: 'en' | 'ar';
}): Promise<{ ok: boolean; status?: 'pending' | 'approved' | 'rejected' | 'duplicate'; error?: string }> {
  const params = new URLSearchParams();
  params.set('lang', opts.lang ?? 'en');
  const res = await apiFetchJson(`questions/suggest/?${params.toString()}`, {
    method: 'POST',
    json: {
      text: opts.text,
      category: opts.category ?? 'surreal',
      language: opts.lang ?? 'en',
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return { ok: false, error: data?.detail || 'Unable to submit.' };
  }
  const data = await res.json().catch(() => null);
  return { ok: true, status: data?.status };
}

/** Local history of recently shown questions — prevents visual repeats between fetches. */
export function rememberShown(q: InspirationQuestion) {
  const cache = readCache().filter((e) => e.q.id !== q.id);
  cache.unshift({ q, at: Date.now() });
  writeCache(cache);
}

export function lastShown(): InspirationQuestion | null {
  const cache = readCache();
  return cache.length > 0 ? cache[0].q : null;
}
