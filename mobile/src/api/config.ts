import Constants from 'expo-constants';

/**
 * Django origin without trailing slash or `/api` suffix.
 * Expo extra.apiUrl may be either `http://host:8000` or `http://host:8000/api`.
 */
function resolveApiOrigin(): string {
  // Same precedence as googleSignIn.ts: local .env override first, then the
  // committed production default in app.json `extra`.
  const raw =
    process.env.EXPO_PUBLIC_API_URL ||
    Constants.expoConfig?.extra?.apiUrl ||
    (__DEV__ ? 'http://10.0.2.2:8000/api' : 'https://98-81-52-33.nip.io/api');

  const trimmed = String(raw).replace(/\/$/, '');
  return trimmed.replace(/\/api$/i, '');
}

export const API_ORIGIN = resolveApiOrigin();

/** Base URL including `/api` (no trailing slash). */
export const API_BASE_URL = `${API_ORIGIN}/api`;

function normalizeMediaPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http')) {
    try {
      const u = new URL(trimmed);
      if (u.pathname.startsWith('/posts/media/')) {
        u.pathname = `/media${u.pathname}`;
        return u.toString();
      }
      return trimmed;
    } catch {
      return trimmed;
    }
  }
  if (trimmed.startsWith('/posts/media/')) return `/media${trimmed}`;
  if (trimmed.startsWith('posts/media/')) return `/media/${trimmed}`;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** Resolve Django media paths (`/media/…`) to absolute URLs. */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  const normalized = normalizeMediaPath(path);
  if (normalized.startsWith('http')) return normalized;
  return `${API_ORIGIN}${normalized}`;
}
