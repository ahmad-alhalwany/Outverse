const cache = new Map<string, string>();

export type GeocodeHit = {
  lat: number;
  lng: number;
  zoom: number;
  label: string;
};

export async function reverseGeocodeLabel(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address;
    if (!addr) return null;
    const city =
      addr.city || addr.town || addr.village || addr.suburb || addr.county;
    const country = addr.country;
    const label = city && country ? `${city}, ${country}` : data.display_name?.split(',').slice(0, 2).join(', ');
    if (label) {
      cache.set(key, label);
      return label;
    }
  } catch {
    /* offline */
  }
  return null;
}

export async function searchLocation(
  query: string,
): Promise<{ lat: number; lng: number; zoom: number } | null> {
  const hits = await searchLocationSuggestions(query, 1);
  if (!hits[0]) return null;
  return { lat: hits[0].lat, lng: hits[0].lng, zoom: hits[0].zoom };
}

export async function searchLocationSuggestions(
  query: string,
  limit = 5,
): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=${limit}`,
      { headers: { Accept: 'application/json' } },
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
