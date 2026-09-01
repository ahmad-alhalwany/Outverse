export type ProfileEmotion = { key: string; labelKey: string; emoji: string; color: string };

export const PROFILE_EMOTIONS: ProfileEmotion[] = [
  { key: 'joy', labelKey: 'bottles.emotionJoy', emoji: '☀️', color: '#F2A93B' },
  { key: 'hope', labelKey: 'bottles.emotionHope', emoji: '🌅', color: '#3FB6A0' },
  { key: 'calm', labelKey: 'bottles.emotionCalm', emoji: '🌊', color: '#4FA3D1' },
  { key: 'love', labelKey: 'bottles.emotionLove', emoji: '💗', color: '#E86A9C' },
  { key: 'sad', labelKey: 'bottles.emotionSad', emoji: '🌧️', color: '#6E7BD1' },
  { key: 'lonely', labelKey: 'bottles.emotionLonely', emoji: '🌙', color: '#9385D6' },
  { key: 'anxious', labelKey: 'bottles.emotionAnxious', emoji: '🌪️', color: '#E08653' },
  { key: 'nostalgic', labelKey: 'bottles.emotionNostalgic', emoji: '📻', color: '#C49A5A' },
  { key: 'mystery', labelKey: 'bottles.emotionMystery', emoji: '✨', color: '#A86BB0' },
];

const HAPPY_KEYS = new Set(['joy', 'hope', 'calm', 'love']);

export function emotionMeta(key: string | null | undefined): ProfileEmotion {
  return PROFILE_EMOTIONS.find((e) => e.key === key) || PROFILE_EMOTIONS[PROFILE_EMOTIONS.length - 1];
}

export function happyDaysPercent(timeline: { emotion: string | null }[]): number {
  const withMood = timeline.filter((d) => d.emotion);
  if (!withMood.length) return 0;
  const happy = withMood.filter((d) => HAPPY_KEYS.has(d.emotion as string)).length;
  return Math.round((happy / withMood.length) * 100);
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}
