import type { Post } from '@/types';
import type { OrbitList, OrbitListMember } from '@/api/client';

export type OrbitListsPalette = {
  cream: string;
  card: string;
  card2: string;
  white: string;
  brown: string;
  brownDk: string;
  text: string;
  text2: string;
  line: string;
  danger: string;
};

export type OrbitTab = 'mine' | 'following' | 'discover';

export function useOrbitListsPalette(isDark: boolean): OrbitListsPalette {
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
      danger: '#E57373',
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
    danger: '#B23A3A',
  };
}

export const ORBIT_TABS: { key: OrbitTab; labelKey: string }[] = [
  { key: 'mine', labelKey: 'signal.myLists' },
  { key: 'following', labelKey: 'signal.followingLists' },
  { key: 'discover', labelKey: 'signal.discoverLists' },
];

function asId(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function asOrbitList(data: unknown): OrbitList | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const id = asId(obj.id);
  if (!id) return null;
  const owner = obj.owner && typeof obj.owner === 'object' ? (obj.owner as OrbitList['owner']) : undefined;
  const members = Array.isArray(obj.members)
    ? obj.members
        .map((row) => {
          const m = (row || {}) as Record<string, unknown>;
          const uid = asId(m.id);
          if (!uid) return null;
          return {
            id: uid,
            username: String(m.username || ''),
            first_name: m.first_name ? String(m.first_name) : undefined,
            last_name: m.last_name ? String(m.last_name) : undefined,
            added_at: m.added_at ? String(m.added_at) : undefined,
          } as OrbitListMember;
        })
        .filter((row): row is OrbitListMember => Boolean(row))
    : [];
  return {
    id,
    title: String(obj.title || ''),
    description: obj.description ? String(obj.description) : '',
    is_private: Boolean(obj.is_private),
    member_count: Number(obj.member_count ?? members.length),
    is_following: Boolean(obj.is_following),
    members,
    owner,
  };
}

export function asOrbitLists(data: unknown): OrbitList[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return rows.map(asOrbitList).filter((row): row is OrbitList => Boolean(row));
}

export function asOrbitPost(data: unknown): Post | null {
  if (!data || typeof data !== 'object') return null;
  const item = data as Record<string, unknown>;
  const id = item.id as string | number | undefined;
  if (id == null) return null;
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
    created_at: String(item.created_at ?? ''),
  };
}

export function orbitFieldError(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data || typeof data !== 'object') return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.error === 'string') return data.error;
  const first = Object.values(data)[0];
  if (Array.isArray(first) && first[0] != null) return String(first[0]);
  if (typeof first === 'string') return first;
  return fallback;
}
