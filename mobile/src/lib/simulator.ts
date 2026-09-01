export const SIMULATOR_PIN_KEY = 'cosonova_simulator_pins';

export const SIMULATOR_PRESETS = [
  { key: 'chaos', emoji: '🌀', creativity: 85, abstractness: 90, stability: 15 },
  { key: 'disciplined', emoji: '🏛️', creativity: 60, abstractness: 25, stability: 85 },
  { key: 'powerhouse', emoji: '🚀', creativity: 90, abstractness: 40, stability: 75 },
  { key: 'dreamer', emoji: '🌙', creativity: 30, abstractness: 85, stability: 30 },
  { key: 'balanced', emoji: '⚖️', creativity: 50, abstractness: 50, stability: 50 },
] as const;

export const SIMULATOR_FLAVORS: Record<string, string> = {
  balanced: 'simulator.flavorBalanced',
  hihihi: 'simulator.flavorVisionary',
  hihilo: 'simulator.flavorChaotic',
  hilohi: 'simulator.flavorPowerhouse',
  hilolo: 'simulator.flavorReckless',
  lohihi: 'simulator.flavorMethodical',
  lohilo: 'simulator.flavorDreamer',
  lolohi: 'simulator.flavorSteady',
  lololo: 'simulator.flavorQuiet',
};

export type SimulatorBaseline = {
  creativity_score: number;
  completion_rate: number;
  above_average_pct: number;
};

export type SimulatorDims = {
  creativityScore: number;
  completionRate: number;
  activityPulse: number;
};

export type PinnedUniverse = {
  id: string;
  creativity: number;
  abstractness: number;
  stability: number;
  creativityScore: number;
  completionRate: number;
  flavorKey: string;
};

export function useSimulatorPalette(isDark: boolean) {
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
      line: 'rgba(167,139,250,0.22)',
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
  };
}

export function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function getFlavorKey(creativity: number, abstractness: number, stability: number): string {
  const dc = creativity - 50;
  const da = abstractness - 50;
  const ds = stability - 50;
  const THRESH = 15;
  if (Math.abs(dc) < THRESH && Math.abs(da) < THRESH && Math.abs(ds) < THRESH) return 'balanced';
  const bit = (v: number) => (v >= 0 ? 'hi' : 'lo');
  return `${bit(dc)}${bit(da)}${bit(ds)}`;
}

export function flavorKeyFor(key: string) {
  return SIMULATOR_FLAVORS[key] || SIMULATOR_FLAVORS.balanced;
}

export function projectUniverse(
  baseline: SimulatorBaseline | null,
  creativity: number,
  abstractness: number,
  stability: number,
  seed: number,
): SimulatorDims {
  const baseCreativity = baseline?.creativity_score ?? 50;
  const baseCompletion = baseline?.completion_rate ?? 50;
  const baseActivity = clampScore(50 + (baseline?.above_average_pct ?? 0) / 2);
  const modifier = creativity - 50 + (abstractness - 50) * 0.6 - (stability - 50) * 0.3;
  const noise = Math.round(seededRandom(seed + creativity + abstractness + stability) * 20 - 10);
  return {
    creativityScore: clampScore(baseCreativity + modifier * 0.5 + noise),
    completionRate: clampScore(baseCompletion - modifier * 0.3 + noise),
    activityPulse: clampScore(baseActivity + modifier * 0.4 + noise * 0.5),
  };
}

export function currentDimensions(baseline: SimulatorBaseline | null): SimulatorDims {
  return {
    creativityScore: baseline?.creativity_score ?? 0,
    completionRate: baseline?.completion_rate ?? 0,
    activityPulse: clampScore(50 + (baseline?.above_average_pct ?? 0) / 2),
  };
}

export function asPinnedUniverses(raw: string | null): PinnedUniverse[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
