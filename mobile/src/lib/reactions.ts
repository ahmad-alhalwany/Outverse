// Mirrors cosonova-dashboard/lib/reactions.ts — same 5 types/emoji/colors
// so mobile and web reactions stay visually and semantically identical.
export type ReactionType = 'inspired' | 'cosmic' | 'mindbending' | 'growing' | 'spark';

export const COSMIC_REACTIONS: { emoji: string; label: string; color: string; type: ReactionType }[] = [
  { emoji: '💡', label: 'ملهم', color: '#FFD700', type: 'inspired' },
  { emoji: '🌌', label: 'كوني', color: '#8B5CF6', type: 'cosmic' },
  { emoji: '🌀', label: 'مذهل', color: '#22D3EE', type: 'mindbending' },
  { emoji: '🌱', label: 'ينمو', color: '#4ADE80', type: 'growing' },
  { emoji: '✨', label: 'شرارة', color: '#F472B6', type: 'spark' },
];

export const REACTION_BY_TYPE: Record<ReactionType, typeof COSMIC_REACTIONS[number]> = Object.fromEntries(
  COSMIC_REACTIONS.map((r) => [r.type, r]),
) as Record<ReactionType, typeof COSMIC_REACTIONS[number]>;

export function totalReactions(counts?: Record<string, number>) {
  return Object.values(counts || {}).reduce((a, b) => a + b, 0);
}
