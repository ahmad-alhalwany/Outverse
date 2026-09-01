export type CommunitiesPalette = {
  cream: string;
  card: string;
  card2: string;
  white: string;
  brown: string;
  brownDk: string;
  text: string;
  text2: string;
  line: string;
  overlay: string;
};

export type CommunityRow = {
  id: number | string;
  slug: string;
  name: string;
  description?: string;
  cover_url?: string;
  rules?: string[];
  flair_options?: string[];
  members_count?: number;
  posts_count?: number;
  privacy?: 'public' | 'private' | string;
  is_nsfw?: boolean;
  spoilers_enabled?: boolean;
  posting_permission?: 'members' | 'mods';
  is_member?: boolean;
  is_pending?: boolean;
  is_banned?: boolean;
  is_moderator?: boolean;
  creator_username?: string;
};

export function useCommunitiesPalette(isDark: boolean): CommunitiesPalette {
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
      overlay: 'rgba(10,8,24,0.65)',
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
    overlay: 'rgba(33,27,61,0.45)',
  };
}

export function asCommunities(data: unknown): CommunityRow[] {
  if (Array.isArray(data)) return data as CommunityRow[];
  if (data && typeof data === 'object') {
    const obj = data as { results?: CommunityRow[]; communities?: CommunityRow[] };
    if (Array.isArray(obj.results)) return obj.results;
    if (Array.isArray(obj.communities)) return obj.communities;
  }
  return [];
}
