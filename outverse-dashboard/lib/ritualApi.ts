import { apiFetch, apiFetchJson } from './api';
import type { InspirationQuestion } from './questionsApi';

export type RitualPeriod = 'morning' | 'evening';

export type DailyRitual = {
  ritual: {
    period: RitualPeriod;
    date: string;
    completed: boolean;
  };
  question: InspirationQuestion;
  streak: number;
};

/** Fetch today's ritual prompt (auto-detects period if omitted). */
export async function fetchDailyRitual(opts?: {
  period?: RitualPeriod;
  lang?: 'en' | 'ar';
}): Promise<DailyRitual | null> {
  const params = new URLSearchParams();
  if (opts?.period) params.set('period', opts.period);
  params.set('lang', opts?.lang ?? 'en');

  try {
    const res = await apiFetch(`questions/daily/?${params.toString()}`, { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data || data.available === false || !data.question) return null;
    return data as DailyRitual;
  } catch {
    return null;
  }
}

/** Mark today's ritual as completed. Idempotent. */
export async function completeDailyRitual(opts?: {
  period?: RitualPeriod;
  lang?: 'en' | 'ar';
}): Promise<DailyRitual | null> {
  const params = new URLSearchParams();
  if (opts?.period) params.set('period', opts.period);
  params.set('lang', opts?.lang ?? 'en');

  try {
    const res = await apiFetchJson(`questions/daily/?${params.toString()}`, { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data || data.available === false || !data.question || !data.ritual) return null;
    return data as DailyRitual;
  } catch {
    return null;
  }
}