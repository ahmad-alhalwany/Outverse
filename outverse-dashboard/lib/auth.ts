import { apiUrl } from './api';

export type AuthUser = {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  avatar?: string | null;
  is_staff?: boolean;
  is_verified?: boolean;
  onboarding_completed?: boolean;
  interests?: string[];
};
const USER_KEY = 'cosmory_user';
const TOKEN_KEY = 'cosmory_token';
const CSRF_COOKIE_KEY = 'csrftoken';
const SESSION_COOKIE_KEYS = ['sessionid', 'cosmory_session', 'authjs.session-token', '__Secure-authjs.session-token'];

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function hasSessionCookie(): boolean {
  return SESSION_COOKIE_KEYS.some((key) => !!readCookie(key));
}

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

/** @deprecated Prefer useAuthUser / useProfileHref in render to avoid hydration mismatch. */
export function getCurrentUserId(): number | null {
  return getUser()?.id ?? null;
}

export function isAuthenticated(): boolean {
  return hasSessionCookie() || !!getUser();
}

export function setAuth(token: string | null, user: AuthUser | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders(): Record<string, string> {
  const csrfToken = readCookie(CSRF_COOKIE_KEY);
  const token = getToken();
  return {
    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };
}

/** fetch wrapper that injects the auth token automatically. */
export async function authFetch(input: string, init: RequestInit = {}) {
  const headers = {
    ...(init.headers as Record<string, string> | undefined),
    ...authHeaders(),
  };
  return fetch(input, { ...init, headers, credentials: 'include' });
}

export async function login(
  username: string,
  password: string,
): Promise<AuthUser | { requires_2fa: true; pending_token: string }> {
  const res = await fetch(apiUrl('users/login/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || 'Login failed. Check your credentials.') as Error & { code?: string };
    if (data.code) error.code = data.code;
    throw error;
  }
  if (data.requires_2fa && data.pending_token) {
    return { requires_2fa: true, pending_token: data.pending_token };
  }
  setAuth(data.token ?? null, data.user);
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
    credentials: 'include',
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
  setAuth(data.token ?? null, data.user);
  return data.user as AuthUser;
}

export async function verifyEmail(token: string): Promise<void> {
  const res = await fetch(apiUrl('users/verify-email/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Verification failed.');
}

export async function forgotPassword(email: string): Promise<string> {
  const res = await fetch(apiUrl('users/forgot-password/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Unable to send reset email.');
  return data.message as string;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const res = await fetch(apiUrl('users/reset-password/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token, new_password: newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Unable to reset password.');
}

export async function checkUsernameAvailability(username: string): Promise<boolean> {
  const res = await fetch(apiUrl(`users/check-username/?username=${encodeURIComponent(username)}`), {
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Unable to check username.');
  return Boolean(data.available);
}

export async function logout() {
  try {
    await fetch(apiUrl('users/logout/'), { method: 'POST', headers: authHeaders(), credentials: 'include' });
  } catch {
    /* ignore network errors on logout */
  }
  clearAuth();
}

/** Validate token and refresh user fields (e.g. is_staff) from the API. */
export async function refreshSession(): Promise<AuthUser | null> {
  // Avoid noisy 401s when the visitor has no session at all.
  if (!getToken() && !hasSessionCookie() && !getUser()) {
    return null;
  }
  try {
    const res = await fetch(apiUrl('users/me/'), { headers: authHeaders(), credentials: 'include' });
    if (!res.ok) {
      if (res.status === 401) clearAuth();
      return null;
    }
    const data = await res.json();
    const prev = getUser();
    const updated: AuthUser = {
      id: data.id,
      username: data.username,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      avatar: data.avatar,
      is_staff: data.is_staff,
      is_verified: data.is_verified,
      onboarding_completed: data.onboarding_completed,
      interests: Array.isArray(data.interests) ? data.interests : [],
    };
    if (prev?.id === updated.id || hasSessionCookie()) {
      setAuth(null, updated);
    }
    return updated;
  } catch {
    return getUser();
  }
}
