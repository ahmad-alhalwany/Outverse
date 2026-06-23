import { apiFetch, apiFetchJson } from './api';
import type {
  AdminChallenge,
  AdminDashboardData,
  AdminFlagged,
  AdminProfile,
  AdminReel,
  AdminShopItem,
} from './adminTypes';

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  const res = await apiFetch('analytics/dashboard/');
  if (res.status === 403) throw new Error('STAFF_REQUIRED');
  if (!res.ok) throw new Error('Failed to load dashboard');
  return res.json();
}

export async function fetchAdminProfiles(): Promise<AdminProfile[]> {
  const res = await apiFetch('users/profiles/');
  if (!res.ok) throw new Error('Failed to load users');
  return res.json();
}

export async function patchProfile(
  id: number,
  data: Partial<Pick<AdminProfile, 'status' | 'points' | 'achievements'>>,
) {
  return apiFetchJson(`users/profiles/${id}/`, {
    method: 'PATCH',
    json: data,
  });
}

export async function fetchShopItemsAdmin(): Promise<AdminShopItem[]> {
  const res = await apiFetch('shop/items/');
  if (!res.ok) throw new Error('Failed to load shop items');
  return res.json();
}

export async function saveShopItem(
  data: Partial<AdminShopItem> & { name: string; description: string; price: number },
  id?: number,
) {
  if (id) {
    return apiFetchJson(`shop/items/${id}/`, { method: 'PATCH', json: data });
  }
  return apiFetchJson('shop/items/', { method: 'POST', json: data });
}

export async function deleteShopItem(id: number) {
  return apiFetch(`shop/items/${id}/`, { method: 'DELETE' });
}

export async function fetchChallengesAdmin(): Promise<AdminChallenge[]> {
  const res = await apiFetch('challenges/');
  if (!res.ok) throw new Error('Failed to load challenges');
  return res.json();
}

export async function saveChallenge(
  data: Partial<AdminChallenge> & { title: string; end_date: string },
  id?: number,
) {
  if (id) {
    return apiFetchJson(`challenges/${id}/`, { method: 'PATCH', json: data });
  }
  return apiFetchJson('challenges/', { method: 'POST', json: data });
}

export async function deleteChallenge(id: number) {
  return apiFetch(`challenges/${id}/`, { method: 'DELETE' });
}

export async function fetchReelsAdmin(): Promise<AdminReel[]> {
  const res = await apiFetch('reels/?admin=1');
  if (!res.ok) throw new Error('Failed to load reels');
  return res.json();
}

export async function patchReel(id: number, data: Partial<AdminReel>) {
  return apiFetchJson(`reels/${id}/`, { method: 'PATCH', json: data });
}

export async function deleteReel(id: number) {
  return apiFetch(`reels/${id}/`, { method: 'DELETE' });
}

export async function fetchFlagged(): Promise<AdminFlagged[]> {
  const res = await apiFetch('moderation/flagged/');
  if (!res.ok) throw new Error('Failed to load flagged content');
  return res.json();
}

export async function patchFlagged(id: number, status: 'approved' | 'rejected') {
  return apiFetchJson(`moderation/flagged/${id}/`, {
    method: 'PATCH',
    json: { status },
  });
}

export async function checkStaffAccess(): Promise<boolean> {
  const res = await apiFetch('users/me/');
  if (!res.ok) return false;
  const data = await res.json();
  return !!data.is_staff;
}
