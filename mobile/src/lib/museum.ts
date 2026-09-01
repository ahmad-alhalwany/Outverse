export type MuseumExhibition = 'all' | 'burned_ideas' | 'collapsed_challenges' | 'beautiful_disasters';
export type MuseumSort = 'new' | 'top';

export type MuseumUser = {
  username: string;
  avatar?: string | null;
};

export type FailedIdea = {
  id: number;
  title: string;
  description: string;
  lesson_learned: string;
  exhibition: string;
  exhibition_display: string;
  cover_url: string;
  user: MuseumUser;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
};

export type FailedIdeaComment = {
  id: number;
  content: string;
  created_at: string;
  user: MuseumUser;
};

export type MuseumPalette = {
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

export const MUSEUM_EXHIBITIONS: MuseumExhibition[] = [
  'all',
  'burned_ideas',
  'collapsed_challenges',
  'beautiful_disasters',
];

export const MUSEUM_EXHIBITION_LABEL: Record<MuseumExhibition, string> = {
  all: 'museum.exhibitionAll',
  burned_ideas: 'museum.exhibitionBurnedIdeas',
  collapsed_challenges: 'museum.exhibitionCollapsedChallenges',
  beautiful_disasters: 'museum.exhibitionBeautifulDisasters',
};

export const MUSEUM_SORTS: MuseumSort[] = ['new', 'top'];

export const MUSEUM_SORT_LABEL: Record<MuseumSort, string> = {
  new: 'museum.sortNewest',
  top: 'museum.sortTop',
};

export function useMuseumPalette(isDark: boolean): MuseumPalette {
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

export function asFailedIdeas(data: unknown): FailedIdea[] {
  if (Array.isArray(data)) return data as FailedIdea[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: FailedIdea[] }).results)) {
    return (data as { results: FailedIdea[] }).results;
  }
  return [];
}

export function asFailedIdeaComments(data: unknown): FailedIdeaComment[] {
  if (Array.isArray(data)) return data as FailedIdeaComment[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: FailedIdeaComment[] }).results)) {
    return (data as { results: FailedIdeaComment[] }).results;
  }
  return [];
}

export function exhibitionLabelKey(exhibition: string): string {
  if (exhibition in MUSEUM_EXHIBITION_LABEL) {
    return MUSEUM_EXHIBITION_LABEL[exhibition as MuseumExhibition];
  }
  return 'museum.exhibitionBurnedIdeas';
}
