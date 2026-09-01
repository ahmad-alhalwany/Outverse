export type CharacterRarity = 'rare' | 'epic' | 'legendary';

export type MarketCharacter = {
  id: number;
  name: string;
  description: string;
  rarity: string;
  rarity_display: string;
  image_url: string;
  emoji: string;
  price: number;
  owned: boolean;
  is_ai_generated: boolean;
  is_public: boolean;
  balance?: number;
};

export type CharactersPalette = {
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

export const MYSTERY_SUMMON_COST = 120;
export const CREATE_CUSTOM_COST = 150;
export const RARITY_ORDER = ['rare', 'epic', 'legendary'] as const;

export const RARITY_COLOR: Record<string, string> = {
  rare: '#4ade80',
  epic: '#818cf8',
  legendary: '#facc15',
};

export function useCharactersPalette(isDark: boolean): CharactersPalette {
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

export function asCharacters(data: unknown): MarketCharacter[] {
  if (Array.isArray(data)) return data as MarketCharacter[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: MarketCharacter[] }).results)) {
    return (data as { results: MarketCharacter[] }).results;
  }
  return [];
}

export function characterApiError(err: unknown): string | undefined {
  if (!err || typeof err !== 'object' || !('response' in err)) return undefined;
  const data = (err as { response?: { data?: { error?: string } } }).response?.data;
  return typeof data?.error === 'string' ? data.error : undefined;
}

export function canMergePair(a?: MarketCharacter, b?: MarketCharacter) {
  if (!a || !b) return false;
  if (a.rarity !== b.rarity) return false;
  return RARITY_ORDER.indexOf(a.rarity as CharacterRarity) < RARITY_ORDER.length - 1;
}
