import { authHeaders } from './auth';

/** Django API origin (no trailing slash). Override via NEXT_PUBLIC_API_URL. */
export const API_ORIGIN = (
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://127.0.0.1:8000'
);

/** Build a path under `/api/…` */
export function apiUrl(path: string): string {
  const segment = path.replace(/^\/+/, '');
  return `${API_ORIGIN}/api/${segment}`;
}

/** Resolve uploaded media paths from Django (`/media/…`). */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

/** @deprecated Use `mediaUrl` — kept for existing imports */
export const fullMediaUrl = mediaUrl;

/** fetch with auth token when present */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers as HeadersInit);
  Object.entries(authHeaders()).forEach(([k, v]) => headers.set(k, v));
  const url = path.startsWith('http') ? path : apiUrl(path);
  return fetch(url, { ...init, headers });
}

/** JSON POST/PATCH/DELETE with auth */
export async function apiFetchJson(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<Response> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers as HeadersInit);
  headers.set('Content-Type', 'application/json');
  Object.entries(authHeaders()).forEach(([k, v]) => headers.set(k, v));
  const url = path.startsWith('http') ? path : apiUrl(path);
  return fetch(url, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
}
