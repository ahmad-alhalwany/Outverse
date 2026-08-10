/** True if a string looks like an email address (must never be shown publicly). */
export function looksLikeEmail(value: string | null | undefined): boolean {
  const s = (value || '').trim();
  if (!s || !s.includes('@')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

type NameParts = {
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
} | null | undefined;

/**
 * Public-facing display name for comments, posts, reactions, etc.
 * Prefer first/last name; never expose a full email (even if stored as username).
 */
export function publicDisplayName(user: NameParts, fallback = 'Traveler'): string {
  if (!user) return fallback;

  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  if (full && !looksLikeEmail(full)) return full;

  const name = (user.name || '').trim();
  if (name && !looksLikeEmail(name)) return name;

  const username = (user.username || '').trim();
  if (username && !looksLikeEmail(username)) return username;

  // Username was an email — show only the local part, never the full address.
  if (username && looksLikeEmail(username)) {
    const local = username.split('@')[0]?.trim();
    if (local) return local;
  }

  return fallback;
}
