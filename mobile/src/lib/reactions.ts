// Mirrors cosonova-dashboard/lib/reactions.ts — same 5 types/emoji/colors
// so mobile and web reactions stay visually and semantically identical.
export type ReactionType = 'inspired' | 'cosmic' | 'mindbending' | 'growing' | 'spark';

export const COSMIC_REACTIONS: { emoji: string; label: string; color: string; type: ReactionType }[] = [
  { emoji: '💡', label: 'Inspired', color: '#FFD700', type: 'inspired' },
  { emoji: '🌌', label: 'Cosmic', color: '#8B5CF6', type: 'cosmic' },
  { emoji: '🌀', label: 'Mind-Bending', color: '#22D3EE', type: 'mindbending' },
  { emoji: '🌱', label: 'Growing', color: '#4ADE80', type: 'growing' },
  { emoji: '✨', label: 'Spark', color: '#F472B6', type: 'spark' },
];

export const REACTION_BY_TYPE: Record<ReactionType, typeof COSMIC_REACTIONS[number]> = Object.fromEntries(
  COSMIC_REACTIONS.map((r) => [r.type, r]),
) as Record<ReactionType, typeof COSMIC_REACTIONS[number]>;

export const REACTION_TYPE_BY_EMOJI: Record<string, ReactionType> = Object.fromEntries(
  COSMIC_REACTIONS.map((r) => [r.emoji, r.type]),
) as Record<string, ReactionType>;

export const EMOJI_BY_REACTION_TYPE: Record<ReactionType, string> = Object.fromEntries(
  COSMIC_REACTIONS.map((r) => [r.type, r.emoji]),
) as Record<ReactionType, string>;

/** API returns type keys; the website UI counts by emoji. Accept both. */
export function countsToEmojiMap(counts?: Record<string, number>) {
  const out: Record<string, number> = {};
  Object.entries(counts || {}).forEach(([key, count]) => {
    if (!count) return;
    if (COSMIC_REACTIONS.some((r) => r.emoji === key)) {
      out[key] = (out[key] || 0) + count;
      return;
    }
    const emoji = EMOJI_BY_REACTION_TYPE[key as ReactionType];
    if (emoji) out[emoji] = (out[emoji] || 0) + count;
  });
  return out;
}

export function selectedEmoji(myReaction?: string | null) {
  if (!myReaction) return undefined;
  if (COSMIC_REACTIONS.some((r) => r.emoji === myReaction)) return myReaction;
  return EMOJI_BY_REACTION_TYPE[myReaction as ReactionType];
}

export function totalReactions(counts?: Record<string, number>) {
  return Object.values(counts || {}).reduce((a, b) => a + b, 0);
}
