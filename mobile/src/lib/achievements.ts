export type AchievementsPalette = {
  cream: string;
  card: string;
  card2: string;
  white: string;
  brown: string;
  brownDk: string;
  text: string;
  text2: string;
  line: string;
  progressBg: string;
  lockedIcon: string;
};

export type Achievement = {
  title: string;
  key: string;
  category: string;
  completed: boolean;
  progress: number;
  goal: number;
};

export type PassportWorld = {
  key: string;
  count: number;
};

export const CATEGORY_ORDER = ['content', 'community', 'bazaar', 'vault', 'live'] as const;

export const CATEGORY_ICON: Record<string, 'book-outline' | 'people-outline' | 'bulb-outline' | 'lock-closed-outline' | 'videocam-outline'> = {
  content: 'book-outline',
  community: 'people-outline',
  bazaar: 'bulb-outline',
  vault: 'lock-closed-outline',
  live: 'videocam-outline',
};

export const STAMP_EMOJI: Record<string, string> = {
  lab: '🧪',
  bottles: '🍶',
  ideas: '💡',
  capsules: '⏳',
  communities: '🌍',
  live: '📡',
};

const TITLE_KEYS: Record<string, string> = {
  first_post: 'achievements.titleFirstPost',
  post_10: 'achievements.titlePost10',
  post_50: 'achievements.titlePost50',
  community_join_1: 'achievements.titleCommunityJoin1',
  community_join_5: 'achievements.titleCommunityJoin5',
  idea_create_1: 'achievements.titleIdeaCreate1',
  idea_create_5: 'achievements.titleIdeaCreate5',
  capsule_open_1: 'achievements.titleCapsuleOpen1',
  live_end_1: 'achievements.titleLiveEnd1',
  live_end_5: 'achievements.titleLiveEnd5',
};

export function useAchievementsPalette(isDark: boolean): AchievementsPalette {
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
      progressBg: 'rgba(255,255,255,0.08)',
      lockedIcon: '#4A4570',
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
    progressBg: 'rgba(124,58,237,0.12)',
    lockedIcon: '#C3BCE0',
  };
}

function asCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function asAchievement(data: unknown): Achievement | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const title = String(obj.title || '').trim();
  const key = String(obj.key || '').trim();
  if (!title && !key) return null;
  return {
    title,
    key,
    category: String(obj.category || 'content').trim() || 'content',
    completed: Boolean(obj.completed),
    progress: asCount(obj.progress),
    goal: asCount(obj.goal),
  };
}

export function asAchievements(data: unknown): Achievement[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { achievements?: unknown[] }).achievements)
      ? (data as { achievements: unknown[] }).achievements
      : [];
  return rows.map(asAchievement).filter((row): row is Achievement => Boolean(row));
}

export function asPassportWorlds(data: unknown): PassportWorld[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.worlds) && obj.worlds.length) {
    return obj.worlds
      .map((row) => {
        const item = (row || {}) as Record<string, unknown>;
        const key = String(item.key || item.world || '').trim();
        if (!key) return null;
        return { key, count: asCount(item.count ?? item.value) };
      })
      .filter((row): row is PassportWorld => Boolean(row));
  }
  const stamps = (obj.stamps && typeof obj.stamps === 'object' ? obj.stamps : obj) as Record<string, unknown>;
  const mapped: PassportWorld[] = [
    { key: 'lab', count: asCount(stamps.lab_streak) },
    { key: 'bottles', count: asCount(stamps.bottles_caught) },
    { key: 'ideas', count: asCount(stamps.ideas_launched) },
    { key: 'capsules', count: asCount(stamps.capsules_opened) },
    { key: 'communities', count: asCount(stamps.communities_joined) },
    { key: 'live', count: asCount(stamps.lives_hosted) },
  ];
  return mapped;
}

export function isUnlocked(item: Achievement): boolean {
  return Boolean(item.completed) || (item.goal > 0 && item.progress >= item.goal);
}

export function achievementTitle(item: Achievement, t: (key: string) => string): string {
  const key = item.key ? TITLE_KEYS[item.key] : undefined;
  return key ? t(key) : item.title;
}

export function categoryLabel(category: string, t: (key: string) => string): string {
  const key = `achievements.category.${category}`;
  const label = t(key);
  return label === key ? category : label;
}

export function worldLabel(key: string, kind: 'world' | 'worldLabel', t: (path: string) => string): string {
  const path = `achievements.${kind}.${key}`;
  const label = t(path);
  return label === path ? key : label;
}

export function groupedAchievements(items: Achievement[]): { category: string; items: Achievement[] }[] {
  const groups: Record<string, Achievement[]> = {};
  for (const item of items) {
    const category = item.category || 'content';
    groups[category] = groups[category] || [];
    groups[category].push(item);
  }
  const known = CATEGORY_ORDER.filter((category) => groups[category]?.length);
  const extra = Object.keys(groups).filter(
    (category) => !CATEGORY_ORDER.includes(category as (typeof CATEGORY_ORDER)[number]),
  );
  return [...known, ...extra].map((category) => ({ category, items: groups[category] }));
}
