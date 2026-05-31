export type ReactionType = 'inspired' | 'cosmic' | 'mindbending' | 'growing' | 'spark';

export const COSMIC_REACTIONS = [
  { emoji: '💡', label: 'Inspired', color: '#FFD700', type: 'inspired' as const, sound: '/sounds/bubblepop-254773.mp3' },
  { emoji: '🌌', label: 'Cosmic', color: '#8B5CF6', type: 'cosmic' as const, sound: '/sounds/shine-11-268907.mp3' },
  { emoji: '🌀', label: 'Mind-Bending', color: '#22D3EE', type: 'mindbending' as const, sound: '/sounds/mystical-chime-196405.mp3' },
  { emoji: '🌱', label: 'Growing', color: '#4ADE80', type: 'growing' as const, sound: '/sounds/sound-effects-finger-snap-without-reverb-113862.mp3' },
  { emoji: '✨', label: 'Spark', color: '#F472B6', type: 'spark' as const, sound: '/sounds/logo-transparent-139678.mp3' },
];

export const REACTION_TYPE_BY_EMOJI: Record<string, ReactionType> = Object.fromEntries(
  COSMIC_REACTIONS.map((r) => [r.emoji, r.type]),
) as Record<string, ReactionType>;

export const EMOJI_BY_REACTION_TYPE: Record<ReactionType, string> = Object.fromEntries(
  COSMIC_REACTIONS.map((r) => [r.type, r.emoji]),
) as Record<ReactionType, string>;

export function countsToEmojiMap(counts?: Record<string, number>) {
  const out: Record<string, number> = {};
  Object.entries(counts || {}).forEach(([type, count]) => {
    const emoji = EMOJI_BY_REACTION_TYPE[type as ReactionType];
    if (emoji && count > 0) out[emoji] = count;
  });
  return out;
}

export function totalReactions(counts?: Record<string, number>) {
  return Object.values(counts || {}).reduce((a, b) => a + b, 0);
}
