/**
 * Aggregate nearby bottles into "how this area feels" regions.
 * Grid size ~0.08° (~8–9 km) matches the design's neighborhood mood dots.
 */
export type RegionMood = {
  id: string;
  lat: number;
  lng: number;
  emotion: string;
  emoji: string;
  color: string;
  label: string;
  count: number;
};

type MoodInput = {
  id: number | string;
  lat: number;
  lng: number;
  emotion?: string;
  emoji: string;
  color: string;
  label?: string;
};

const GRID = 0.08;

function cellKey(lat: number, lng: number) {
  const la = Math.round(lat / GRID) * GRID;
  const ln = Math.round(lng / GRID) * GRID;
  return `${la.toFixed(3)},${ln.toFixed(3)}`;
}

export function computeRegionMoods(markers: MoodInput[]): RegionMood[] {
  if (!markers.length) return [];

  const buckets = new Map<string, MoodInput[]>();
  for (const m of markers) {
    const key = cellKey(m.lat, m.lng);
    const list = buckets.get(key);
    if (list) list.push(m);
    else buckets.set(key, [m]);
  }

  const regions: RegionMood[] = [];
  for (const [key, items] of buckets) {
    const tallies = new Map<string, { count: number; sample: MoodInput }>();
    for (const item of items) {
      const emo = item.emotion || item.label || 'mystery';
      const cur = tallies.get(emo);
      if (cur) cur.count += 1;
      else tallies.set(emo, { count: 1, sample: item });
    }
    let best = [...tallies.values()][0];
    for (const row of tallies.values()) {
      if (row.count > best.count) best = row;
    }
    const [latStr, lngStr] = key.split(',');
    const lat =
      items.reduce((s, i) => s + i.lat, 0) / items.length || parseFloat(latStr);
    const lng =
      items.reduce((s, i) => s + i.lng, 0) / items.length || parseFloat(lngStr);
    regions.push({
      id: `region-${key}`,
      lat,
      lng,
      emotion: best.sample.emotion || best.sample.label || 'mystery',
      emoji: best.sample.emoji,
      color: best.sample.color,
      label: best.sample.label || 'Mood',
      count: items.length,
    });
  }
  return regions.sort((a, b) => b.count - a.count);
}
