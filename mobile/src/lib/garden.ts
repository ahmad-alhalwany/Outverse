import type { BazaarIdea } from '@/lib/bazaar';

export function useGardenPalette(isDark: boolean) {
  if (isDark) {
    return {
      cream: '#0A1F16',
      card: '#123324',
      card2: '#164430',
      white: '#1A4A34',
      brown: '#34D399',
      brownDk: '#10B981',
      text: '#EAFBF2',
      text2: '#8FC7AC',
      line: 'rgba(52,211,153,0.20)',
    };
  }
  return {
    cream: '#EEF9F0',
    card: '#DCF0E0',
    card2: '#F0FAF2',
    white: '#FFFFFF',
    brown: '#059669',
    brownDk: '#047857',
    text: '#0F2E1F',
    text2: '#5F8C74',
    line: 'rgba(5,150,105,0.16)',
  };
}

export function gardenGrowthStage(idea: Pick<BazaarIdea, 'supporters' | 'funding_raised'>) {
  const score = (Number(idea.supporters || 0) * 2) + Math.round(Number(idea.funding_raised || 0) / 50);
  if (score >= 30) return { emoji: '🌳', labelKey: 'garden.stageTree' };
  if (score >= 15) return { emoji: '🌿', labelKey: 'garden.stageSapling' };
  if (score >= 5) return { emoji: '🌱', labelKey: 'garden.stageSprout' };
  return { emoji: '🌰', labelKey: 'garden.stageSeed' };
}

export function asGardenIdeas(data: unknown): BazaarIdea[] {
  if (Array.isArray(data)) return data as BazaarIdea[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: BazaarIdea[] }).results)) {
    return (data as { results: BazaarIdea[] }).results;
  }
  return [];
}
