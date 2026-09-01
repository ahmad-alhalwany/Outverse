export type MemoriesPalette = {
  cream: string;
  card: string;
  card2: string;
  white: string;
  brown: string;
  brownDk: string;
  text: string;
  text2: string;
  line: string;
};

export type FutureMemory = {
  id: number;
  text: string;
  tag: string;
  is_public: boolean;
  username: string;
  created_at: string;
};

export function useMemoriesPalette(isDark: boolean): MemoriesPalette {
  if (isDark) {
    return {
      cream: '#14102A',
      card: '#1E1740',
      card2: '#251B4D',
      white: '#2A2154',
      brown: '#C4B5FD',
      brownDk: '#A78BFA',
      text: '#F5F3FF',
      text2: '#B0A6D9',
      line: 'rgba(167,139,250,0.20)',
    };
  }
  return {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
  };
}

function asId(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function asMemory(data: unknown): FutureMemory | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const id = asId(obj.id);
  if (!id) return null;
  const user = obj.user && typeof obj.user === 'object'
    ? (obj.user as { username?: string })
    : {};
  return {
    id,
    text: String(obj.text || ''),
    tag: String(obj.tag || '').trim(),
    is_public: obj.is_public !== false,
    username: String(user.username || obj.username || ''),
    created_at: String(obj.created_at || ''),
  };
}

export function asMemories(data: unknown): FutureMemory[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return rows.map(asMemory).filter((row): row is FutureMemory => Boolean(row));
}

export function relativeMemoryTime(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return locale === 'ar' ? 'الآن' : 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar' : undefined);
}

export function memoryFieldError(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data || typeof data !== 'object') return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.error === 'string') return data.error;
  const first = Object.values(data)[0];
  if (Array.isArray(first) && first[0] != null) return String(first[0]);
  if (typeof first === 'string') return first;
  return fallback;
}
