const cache = new Map<string, string>();

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
  const q = query.trim();
  if (!q) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data[0]) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      zoom: 12,
    };
  } catch {
    return null;
  }
}
