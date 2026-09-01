export type YearPalette = {
  page: string;
  card: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
  chipBg: string;
  gold: string;
};

export type YearFirstPost = {
  id: number;
  text: string;
  created_at: string;
};

export type YearCountRow = {
  key: string;
  count: number;
};

export type YearInReview = {
  year: number;
  posts_count: number;
  words_written: number;
  longest_post_chars: number;
  first_post: YearFirstPost | null;
  top_tags: YearCountRow[];
  top_categories: YearCountRow[];
  capsules_created: number;
  capsules_opened: number;
  rooms_joined: number;
  ritual_days: number;
  ritual_max_streak: number;
  voice_notes: number;
  username: string;
  display_name: string;
};

export function useYearPalette(isDark: boolean): YearPalette {
  if (isDark) {
    return {
      page: '#14102A',
      card: '#1E1740',
      text: '#F5F3FF',
      muted: '#B0A6D9',
      accent: '#C4B5FD',
      border: 'rgba(255,255,255,0.08)',
      chipBg: 'rgba(255,255,255,0.06)',
      gold: '#E8C887',
    };
  }
  return {
    page: '#F3F0FC',
    card: '#FFFFFF',
    text: '#211B3D',
    muted: '#79709E',
    accent: '#7C3AED',
    border: '#E3D9F7',
    chipBg: '#E9E1FA',
    gold: '#C9974F',
  };
}

function asCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asCountRows(rows: unknown, keyName: 'tag' | 'category'): YearCountRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const obj = (row || {}) as Record<string, unknown>;
      const key = String(obj[keyName] || obj.key || '').trim();
      if (!key) return null;
      return { key, count: asCount(obj.count) };
    })
    .filter((row): row is YearCountRow => Boolean(row));
}

export function asYearInReview(data: unknown): YearInReview | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const year = asCount(obj.year) || new Date().getFullYear();
  const first = obj.first_post && typeof obj.first_post === 'object'
    ? (obj.first_post as Record<string, unknown>)
    : null;
  return {
    year,
    posts_count: asCount(obj.posts_count),
    words_written: asCount(obj.words_written),
    longest_post_chars: asCount(obj.longest_post_chars),
    first_post: first && asCount(first.id)
      ? {
          id: asCount(first.id),
          text: String(first.text || ''),
          created_at: String(first.created_at || ''),
        }
      : null,
    top_tags: asCountRows(obj.top_tags, 'tag'),
    top_categories: asCountRows(obj.top_categories, 'category'),
    capsules_created: asCount(obj.capsules_created),
    capsules_opened: asCount(obj.capsules_opened),
    rooms_joined: asCount(obj.rooms_joined),
    ritual_days: asCount(obj.ritual_days),
    ritual_max_streak: asCount(obj.ritual_max_streak),
    voice_notes: asCount(obj.voice_notes),
    username: String(obj.username || ''),
    display_name: String(obj.display_name || obj.username || ''),
  };
}

export function yearHasContent(data: YearInReview): boolean {
  return (
    data.posts_count > 0 ||
    data.capsules_created > 0 ||
    data.ritual_days > 0 ||
    data.rooms_joined > 0
  );
}

export function formatYearNumber(value: number, locale: string): string {
  try {
    return value.toLocaleString(locale === 'ar' ? 'ar' : undefined);
  } catch {
    return String(value);
  }
}

export function formatYearDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale === 'ar' ? 'ar' : undefined);
}
