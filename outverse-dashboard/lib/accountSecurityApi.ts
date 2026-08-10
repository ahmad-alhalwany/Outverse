import { apiFetch, apiUrl } from './api';
import { setAuth, type AuthUser } from './auth';

export type TwoFactorSetup = {
  secret: string;
  otpauth_uri: string;
  is_enabled: boolean;
};

export async function loginWith2fa(
  pendingToken: string,
  code: string,
): Promise<AuthUser> {
  const res = await fetch(apiUrl('users/login/2fa/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ pending_token: pendingToken, code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '2FA verification failed.');
  setAuth(data.token ?? null, data.user);
  return data.user as AuthUser;
}

export async function loginWithGoogle(idToken: string): Promise<AuthUser | { requires_2fa: true; pending_token: string }> {
  const res = await fetch(apiUrl('users/auth/google/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ id_token: idToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Google sign-in failed.');
  if (data.requires_2fa) {
    return { requires_2fa: true, pending_token: data.pending_token };
  }
  setAuth(data.token ?? null, data.user);
  return data.user as AuthUser;
}

export async function loginWithApple(identityToken: string): Promise<AuthUser | { requires_2fa: true; pending_token: string }> {
  const res = await fetch(apiUrl('users/auth/apple/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ identity_token: identityToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Apple sign-in failed.');
  if (data.requires_2fa) {
    return { requires_2fa: true, pending_token: data.pending_token };
  }
  setAuth(data.token ?? null, data.user);
  return data.user as AuthUser;
}

export async function fetch2faSetup(): Promise<TwoFactorSetup | null> {
  const res = await apiFetch('users/me/2fa/');
  if (!res.ok) return null;
  return res.json();
}

export async function enable2fa(code: string): Promise<{ backup_codes: string[] } | null> {
  const res = await apiFetch('users/me/2fa/', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function disable2fa(password: string): Promise<boolean> {
  const res = await apiFetch('users/me/2fa/', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

export async function exportAccountData(): Promise<Record<string, unknown> | null> {
  const res = await apiFetch('users/me/export/');
  if (!res.ok) return null;
  return res.json();
}

export async function deleteAccount(password: string): Promise<boolean> {
  const res = await apiFetch('users/me/delete/', {
    method: 'POST',
    body: JSON.stringify({ password, confirmation: 'DELETE' }),
  });
  return res.ok;
}

export async function submitVerificationRequest(reason: string, links: string[]): Promise<boolean> {
  const res = await apiFetch('users/me/verification/', {
    method: 'POST',
    body: JSON.stringify({ reason, links }),
  });
  return res.ok;
}

export async function fetchVerificationStatus(): Promise<{
  badge_verified: boolean;
  is_verified?: boolean;
  requests: { id: number; status: string; reason: string }[];
} | null> {
  const res = await apiFetch('users/me/verification/');
  if (!res.ok) return null;
  return res.json();
}

export async function submitSellerApplication(reason: string, links: string[]): Promise<boolean> {
  const res = await apiFetch('users/me/seller-application/', {
    method: 'POST',
    body: JSON.stringify({ reason, links }),
  });
  return res.ok;
}

export async function fetchSellerApplicationStatus(): Promise<{
  is_shop_seller: boolean;
  requests: { id: number; status: string; reason: string; review_note?: string }[];
} | null> {
  const res = await apiFetch('users/me/seller-application/');
  if (!res.ok) return null;
  return res.json();
}
