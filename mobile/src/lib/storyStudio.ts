/** Cosmory story studio tokens — mobile mirror of web storyStudio. */

export const STORY_STICKERS = [
  '✨', '🌌', '💫', '🔥', '💜', '🌙', '⭐', '🚀',
  '🎉', '❤️', '😂', '😍', '👍', '🎨', '🌈', '☀️',
  '⚡', '🍀', '🎵', '💯',
];

export const STORY_FILTERS = [
  { key: 'none', label: 'Raw' },
  { key: 'cosmic', label: 'Cosmic' },
  { key: 'glitch', label: 'Glitch' },
  { key: 'vintage', label: 'Vintage' },
  { key: 'neon', label: 'Neon' },
  { key: 'void', label: 'Void' },
  { key: 'dream', label: 'Dream' },
  { key: 'pulse', label: 'Pulse' },
] as const;

export const STORY_MOODS = ['😊', '🎨', '💡', '🎉', '✨'] as const;

export const STORY_BRUSH_COLORS = [
  '#ffffff', '#7C3AED', '#22D3EE', '#F472B6', '#FBBF24', '#EF4444', '#4ADE80',
];

export type StoryOverlay =
  | {
      id: string;
      type: 'text';
      x: number;
      y: number;
      text: string;
      color: string;
      fontSize: number;
      fontWeight: number;
      align?: 'center';
    }
  | {
      id: string;
      type: 'sticker';
      x: number;
      y: number;
      emoji: string;
      scale: number;
    }
  | {
      id: string;
      type: 'poll';
      x: number;
      y: number;
      question: string;
      options: [string, string];
    };

export type StoryStroke = {
  id: string;
  color: string;
  width: number;
  points: { x: number; y: number }[];
};

export function uid(prefix = 'o') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
