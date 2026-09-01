import type { BazaarIdea } from '@/lib/bazaar';
import type { Post } from '@/types';

export type SavedPalette = {
  page: string;
  card: string;
  text: string;
  muted: string;
  accent: string;
  bazaar: string;
  border: string;
  chipBg: string;
  danger: string;
};

export type SavedType = 'post' | 'reel' | 'idea' | 'story';
export type SavedCollectionKey = 'all' | SavedType;

export type SavedItem = Record<string, unknown> & {
  saved_id: string;
  saved_type: SavedType;
};

export type SavedFolder = {
  id: number;
  name: string;
  item_count: number;
  is_public?: boolean;
};

export const SAVED_TABS: { key: SavedCollectionKey; labelKey: string }[] = [
  { key: 'all', labelKey: 'saved.tabAll' },
  { key: 'post', labelKey: 'saved.tabPosts' },
  { key: 'reel', labelKey: 'saved.tabReels' },
  { key: 'idea', labelKey: 'saved.tabIdeas' },
  { key: 'story', labelKey: 'saved.tabStories' },
];

export function useSavedPalette(isDark: boolean): SavedPalette {
  if (isDark) {
    return {
      page: '#14102A',
      card: '#1E1740',
      text: '#F5F3FF',
      muted: '#B0A6D9',
      accent: '#C4B5FD',
      bazaar: '#38BDF8',
      border: 'rgba(255,255,255,0.08)',
      chipBg: 'rgba(255,255,255,0.06)',
      danger: '#E57373',
    };
  }
  return {
    page: '#F3F0FC',
    card: '#FFFFFF',
    text: '#211B3D',
    muted: '#79709E',
    accent: '#7C3AED',
    bazaar: '#0284C7',
    border: '#E3D9F7',
    chipBg: '#E9E1FA',
    danger: '#B23A3A',
  };
}

function asId(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function asSavedItems(data: unknown): SavedItem[] {
  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((row) => {
      const obj = (row || {}) as Record<string, unknown>;
      const type = String(obj.saved_type || '') as SavedType;
      if (!['post', 'reel', 'idea', 'story'].includes(type)) return null;
      const id = asId(obj.id);
      const savedId = typeof obj.saved_id === 'string' && obj.saved_id
        ? obj.saved_id
        : id
          ? `${type}_${id}`
          : '';
      if (!savedId) return null;
      return { ...obj, saved_id: savedId, saved_type: type } as SavedItem;
    })
    .filter(Boolean) as SavedItem[];
}

export function asSavedFolders(data: unknown): SavedFolder[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return rows
    .map((row) => {
      const obj = (row || {}) as Record<string, unknown>;
      const id = asId(obj.id);
      if (!id) return null;
      return {
        id,
        name: String(obj.name || '').trim() || 'Untitled',
        item_count: Number(obj.item_count || 0),
        is_public: Boolean(obj.is_public),
      };
    })
    .filter(Boolean) as SavedFolder[];
}

export function asSavedPost(item: SavedItem): Post | null {
  if (item.saved_type !== 'post') return null;
  const id = (item.id as string | number | undefined) ?? item.saved_id.replace(/^post_/, '');
  const user = (item.user as Post['user']) || {
    id: 0,
    username: 'user',
    email: '',
    followers_count: 0,
    following_count: 0,
    posts_count: 0,
  };
  return {
    ...(item as unknown as Post),
    id,
    user,
    text: String(item.text ?? ''),
    media: Array.isArray(item.media) ? (item.media as Post['media']) : [],
    likes_count: Number(item.likes_count ?? 0),
    comments_count: Number(item.comments_count ?? 0),
    reposts_count: Number(item.reposts_count ?? 0),
    shares_count: Number(item.shares_count ?? 0),
    reaction_counts: (item.reaction_counts as Record<string, number>) || {},
    my_reaction: (item.my_reaction as string | null) ?? null,
    is_saved: true,
    created_at: String(item.created_at ?? ''),
  };
}

export function asSavedIdea(item: SavedItem): BazaarIdea | null {
  if (item.saved_type !== 'idea') return null;
  const id = asId(item.id);
  if (!id) return null;
  return {
    id,
    title: String(item.title || ''),
    description: String(item.description || ''),
    category: item.category ? String(item.category) : undefined,
    cover_url: item.cover_url ? String(item.cover_url) : undefined,
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    supporters: Number(item.supporters || 0),
    owner: (item.owner as BazaarIdea['owner']) || undefined,
    is_voted: Boolean(item.is_voted),
    is_saved: true,
  };
}

export function ownerLabel(value: unknown): string {
  if (value && typeof value === 'object') {
    const obj = value as { username?: string; first_name?: string; last_name?: string };
    const full = `${obj.first_name || ''} ${obj.last_name || ''}`.trim();
    return full || obj.username || '';
  }
  return typeof value === 'string' ? value : '';
}

export function visibleSavedItems(
  items: SavedItem[],
  active: SavedCollectionKey,
  folderId: number | null,
): SavedItem[] {
  if (folderId != null) return items.filter((item) => item.saved_type === 'post');
  if (active === 'all') {
    const ideas = items.filter((item) => item.saved_type === 'idea');
    const posts = items.filter((item) => item.saved_type === 'post');
    const rest = items.filter((item) => item.saved_type !== 'idea' && item.saved_type !== 'post');
    return [...ideas, ...posts, ...rest];
  }
  return items.filter((item) => item.saved_type === active);
}
