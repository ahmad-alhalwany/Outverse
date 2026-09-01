import type { ChatRoomRow } from '@/lib/chat';

export type RoomsPalette = {
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
  expired: string;
};

export type PromptQuestion = {
  id: number;
  text: string;
  category?: string;
  category_label?: string;
};

export const ROOM_CATEGORIES = [
  'all',
  'historical',
  'fantasy',
  'scifi',
  'philosophical',
  'mystery',
  'surreal',
  'everyday',
  'emotional',
] as const;

export const ROOM_CATEGORY_LABEL: Record<string, string> = {
  all: 'inspiration.categoryAll',
  historical: 'inspiration.categoryHistorical',
  fantasy: 'inspiration.categoryFantasy',
  scifi: 'inspiration.categoryScifi',
  philosophical: 'inspiration.categoryPhilosophical',
  mystery: 'inspiration.categoryMystery',
  surreal: 'inspiration.categorySurreal',
  everyday: 'inspiration.categoryEveryday',
  emotional: 'inspiration.categoryEmotional',
};

export function useRoomsPalette(isDark: boolean): RoomsPalette {
  if (isDark) {
    return {
      cream: '#16081F',
      card: '#2A1038',
      card2: '#3B0764',
      white: '#32124A',
      brown: '#F9A8D4',
      brownDk: '#C084FC',
      text: '#FDF4FF',
      text2: '#E9D5FF',
      line: 'rgba(249,168,212,0.22)',
      overlay: 'rgba(10,8,24,0.65)',
      expired: '#FCA5A5',
    };
  }
  return {
    cream: '#FDF4FF',
    card: '#F5E8FF',
    card2: '#FAF5FF',
    white: '#FFFFFF',
    brown: '#C026D3',
    brownDk: '#7C3AED',
    text: '#3B0764',
    text2: '#86198F',
    line: 'rgba(192,38,211,0.16)',
    overlay: 'rgba(59,7,100,0.45)',
    expired: '#B91C1C',
  };
}

export function asPromptRooms(data: unknown): ChatRoomRow[] {
  if (Array.isArray(data)) return data as ChatRoomRow[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as ChatRoomRow[];
    if (Array.isArray(obj.rooms)) return obj.rooms as ChatRoomRow[];
    if (Array.isArray(obj.prompt_rooms)) return obj.prompt_rooms as ChatRoomRow[];
  }
  return [];
}

export function formatRoomExpires(
  expiresAt: string | null | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (!expiresAt) return t('chat.promptRoomOrbit');
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return t('rooms.expired');
  const hours = Math.floor(ms / 3600000);
  const mins = Math.max(1, Math.round((ms % 3600000) / 60000));
  if (hours >= 1) return `${t('rooms.expiresIn')} ${hours}${t('rooms.h')} ${mins}${t('rooms.m')}`;
  return `${t('rooms.expiresIn')} ${mins}${t('rooms.m')}`;
}
