export type GeocodeHit = {
  lat: number;
  lng: number;
  zoom: number;
  label: string;
};

const cache = new Map<string, string>();
const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'CosonovaMobile/1.0 (https://cosonova.com)',
};

export async function reverseGeocodeLabel(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
      { headers: NOMINATIM_HEADERS },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || addr.suburb || addr.county;
    const country = addr.country;
    const label =
      city && country ? `${city}, ${country}` : String(data.display_name || '').split(',').slice(0, 2).join(', ');
    if (label) {
      cache.set(key, label);
      return label;
    }
  } catch {
    /* offline */
  }
  return null;
}

export async function searchLocationSuggestions(query: string, limit = 5): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=${limit}`,
      { headers: NOMINATIM_HEADERS },
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((row: { lat: string; lon: string; display_name?: string }) => ({
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lon),
      zoom: 13,
      label: (row.display_name || `${row.lat}, ${row.lon}`).split(',').slice(0, 3).join(',').trim(),
    }));
  } catch {
    return [];
  }
}

export async function searchLocation(query: string): Promise<GeocodeHit | null> {
  const hits = await searchLocationSuggestions(query, 1);
  return hits[0] || null;
}
