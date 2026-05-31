import { API_ORIGIN } from './api';
import { getToken } from './auth';

/** WebSocket URL on the Django host (daphne), not Next.js. Appends auth token. */
export function wsUrl(path: string): string {
  const segment = path.startsWith('/') ? path : `/${path}`;
  const base = API_ORIGIN.replace(/\/$/, '');
  const wsBase = base.replace(/^http/, 'ws');
  const token = getToken();
  const joiner = segment.includes('?') ? '&' : '?';
  const auth = token ? `${joiner}token=${encodeURIComponent(token)}` : '';
  return `${wsBase}${segment}${auth}`;
}
