/**
 * Demo bundle for Emotion Vault when the API is empty or offline.
 * Enable always with NEXT_PUBLIC_VAULT_DEMO=true
 */

import type { VaultMapMarker } from '@/components/vault/EmotionVaultMap';

export type DemoBottle = {
  id: number;
  emotion_type: string;
  message: string;
  location_lat: number;
  location_lng: number;
  created_at: string;
  expires_at: string;
  is_mine?: boolean;
  place: string;
};

export type DemoDashboard = {
  thrown: number;
  caught: number;
  timeline: { day: number; date: string; emotion: string | null }[];
  insights: { emotion: string; pct: number }[];
  current_mood: string;
};

const EMOTION_COLORS: Record<string, { emoji: string; color: string; label: string }> = {
  joy: { emoji: '☀️', color: '#22c55e', label: 'Happy' },
  hope: { emoji: '🌅', color: '#22c55e', label: 'Happy' },
  love: { emoji: '💗', color: '#22c55e', label: 'Happy' },
  calm: { emoji: '🌊', color: '#3b82f6', label: 'Calm' },
  sad: { emoji: '🌧️', color: '#ef4444', label: 'Sad' },
  lonely: { emoji: '🌙', color: '#ef4444', label: 'Sad' },
  anxious: { emoji: '🌪️', color: '#f97316', label: 'Anxious' },
  nostalgic: { emoji: '📻', color: '#a855f7', label: 'Nostalgic' },
  mystery: { emoji: '✨', color: '#6366f1', label: 'Mystery' },
};

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

export const DEMO_BOTTLES: DemoBottle[] = [
  {
    id: 9001,
    emotion_type: 'joy',
    message: 'Today was an amazing day — the sunset reminded me that small joys matter.',
    location_lat: 48.8566,
    location_lng: 2.3522,
    created_at: hoursAgo(2),
    expires_at: hoursFromNow(22),
    place: 'Paris, France',
  },
  {
    id: 9002,
    emotion_type: 'hope',
    message: 'Feeling hopeful about the new chapter starting next week.',
    location_lat: 35.6762,
    location_lng: 139.6503,
    created_at: hoursAgo(5),
    expires_at: hoursFromNow(19),
    place: 'Tokyo, Japan',
  },
  {
    id: 9003,
    emotion_type: 'calm',
    message: 'Quiet morning by the harbor. Breathing slowly. Grateful for stillness.',
    location_lat: 40.7128,
    location_lng: -74.006,
    created_at: hoursAgo(8),
    expires_at: hoursFromNow(16),
    place: 'New York, USA',
  },
  {
    id: 9004,
    emotion_type: 'sad',
    message: 'Rain on the window. Some days are heavy — that is okay.',
    location_lat: 52.52,
    location_lng: 13.405,
    created_at: hoursAgo(6),
    expires_at: hoursFromNow(18),
    place: 'Berlin, Germany',
  },
  {
    id: 9005,
    emotion_type: 'love',
    message: 'Heart full after helping a stranger. Love spreads quietly.',
    location_lat: -33.8688,
    location_lng: 151.2093,
    created_at: hoursAgo(3),
    expires_at: hoursFromNow(21),
    place: 'Sydney, Australia',
  },
  {
    id: 9006,
    emotion_type: 'anxious',
    message: 'Big presentation tomorrow. Butterflies — wish me luck, universe.',
    location_lat: 25.2048,
    location_lng: 55.2708,
    created_at: hoursAgo(1),
    expires_at: hoursFromNow(23),
    place: 'Dubai, UAE',
  },
  {
    id: 9007,
    emotion_type: 'lonely',
    message: 'Alone in a new city but learning to enjoy my own company.',
    location_lat: 37.7749,
    location_lng: -122.4194,
    created_at: hoursAgo(9),
    expires_at: hoursFromNow(15),
    place: 'San Francisco, USA',
  },
  {
    id: 9008,
    emotion_type: 'mystery',
    message: 'Found a note in an old book. Your words still echo.',
    location_lat: 41.9028,
    location_lng: 12.4964,
    created_at: hoursAgo(4),
    expires_at: hoursFromNow(20),
    place: 'Rome, Italy',
  },
];

const TIMELINE_EMOTIONS = [
  'joy', 'joy', 'calm', 'hope', 'sad', 'calm', 'love', 'joy', 'anxious', 'calm',
  'joy', 'sad', 'calm', 'hope', 'joy', 'calm', 'love', 'sad', 'calm', 'joy',
  'hope', 'calm', 'joy', 'sad', 'calm', 'love', 'joy', 'calm', 'hope', 'joy',
];

export const DEMO_DASHBOARD: DemoDashboard = {
  thrown: 124,
  caught: 89,
  current_mood: 'joy',
  timeline: TIMELINE_EMOTIONS.map((emotion, i) => ({
    day: i + 1,
    date: new Date(Date.now() - (29 - i) * 86400_000).toISOString().slice(0, 10),
    emotion,
  })),
  insights: [
    { emotion: 'joy', pct: 42 },
    { emotion: 'sad', pct: 28 },
    { emotion: 'calm', pct: 30 },
  ],
};

export function demoMarkers(showOwnMessage: boolean): VaultMapMarker[] {
  return DEMO_BOTTLES.map((b) => {
    const em = EMOTION_COLORS[b.emotion_type] || EMOTION_COLORS.mystery;
    return {
      id: b.id,
      lat: b.location_lat,
      lng: b.location_lng,
      color: em.color,
      emoji: em.emoji,
      label: em.label,
      expiresAt: b.expires_at,
      isMine: false,
      message: b.message,
      showOwnMessage,
    };
  });
}

export function demoPlaceLabels(): Record<number, string> {
  return Object.fromEntries(DEMO_BOTTLES.map((b) => [b.id, b.place]));
}

export function shouldUseVaultDemo(apiEmpty: boolean): boolean {
  if (process.env.NEXT_PUBLIC_VAULT_DEMO === 'true') return true;
  return apiEmpty;
}

export function emotionDisplay(key: string) {
  return EMOTION_COLORS[key] || EMOTION_COLORS.mystery;
}

/** Group insights into Happy / Sad / Calm like the mockup */
export function moodSummaryRows(insights: { emotion: string; pct: number }[]) {
  const groups = { happy: 0, sad: 0, calm: 0 };
  for (const it of insights) {
    if (['joy', 'hope', 'love'].includes(it.emotion)) groups.happy += it.pct;
    else if (['sad', 'lonely', 'nostalgic'].includes(it.emotion)) groups.sad += it.pct;
    else if (['calm', 'mystery'].includes(it.emotion)) groups.calm += it.pct;
  }
  const total = groups.happy + groups.sad + groups.calm || 1;
  return [
    { key: 'happy', label: 'Happy', emoji: '😊', color: '#22c55e', pct: Math.round((groups.happy / total) * 100) },
    { key: 'sad', label: 'Sad', emoji: '😢', color: '#ef4444', pct: Math.round((groups.sad / total) * 100) },
    { key: 'calm', label: 'Calm', emoji: '😌', color: '#3b82f6', pct: Math.round((groups.calm / total) * 100) },
  ];
}
