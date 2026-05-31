import { apiUrl } from './api';

export type AuthUser = {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  avatar?: string | null;
};
const TOKEN_KEY = 'outverse_token';
const USER_KEY = 'outverse_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/** Returns the logged-in user id, or 1 as a fallback while auth is optional. */
export function getCurrentUserId(): number {
  return getUser()?.id ?? 1;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function setAuth(token: string, user: AuthUser) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Token ${token}` } : {};
}

/** fetch wrapper that injects the auth token automatically. */
export async function authFetch(input: string, init: RequestInit = {}) {
  const headers = {
    ...(init.headers as Record<string, string> | undefined),
    ...authHeaders(),
  };
  return fetch(input, { ...init, headers });
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(apiUrl('users/login/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Login failed. Check your credentials.');
  setAuth(data.token, data.user);
  return data.user as AuthUser;
}

export type RegisterPayload = {
  username: string;
  password: string;
  email?: string;
  first_name?: string;
  last_name?: string;
};

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  const res = await fetch(apiUrl('users/register/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const firstError =
      data.username?.[0] ||
      data.email?.[0] ||
      data.password?.[0] ||
      data.error ||
      'Registration failed.';
    throw new Error(firstError);
  }
  setAuth(data.token, data.user);
  return data.user as AuthUser;
}

export async function logout() {
  try {
    await fetch(apiUrl('users/logout/'), { method: 'POST', headers: authHeaders() });
  } catch {
    /* ignore network errors on logout */
  }
  clearAuth();
}
