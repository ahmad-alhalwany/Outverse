import { apiFetch, apiFetchJson } from './api';
import type {
  AdminBottle,
  AdminComment,
  AdminChallenge,
  AdminDashboardData,
  AdminFlagged,
  AdminIdea,
  AdminPost,
  AdminProfile,
  AdminReel,
  AdminShopItem,
  AdminStory,
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

export async function promoteProfileToStaff(userId: number) {
  return apiFetchJson(`users/${userId}/promote/`, { method: 'POST' });
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

export async function checkStaffAccess(): Promise<'ok' | 'auth' | 'denied'> {
  const res = await apiFetch('users/me/');
  if (res.status === 401 || res.status === 403) return 'auth';
  if (!res.ok) return 'denied';
  const data = await res.json();
  return data.is_staff ? 'ok' : 'denied';
}

export async function fetchIdeasAdmin(): Promise<AdminIdea[]> {
  const res = await apiFetch('ideas/?ordering=trending');
  if (!res.ok) throw new Error('Failed to load ideas');
  return res.json();
}

export async function saveIdea(
  data: Partial<AdminIdea> & { title: string; description: string },
  id?: number,
) {
  if (id) {
    return apiFetchJson(`ideas/${id}/`, { method: 'PATCH', json: data });
  }
  return apiFetchJson('ideas/', { method: 'POST', json: data });
}

export async function deleteIdea(id: number) {
  return apiFetch(`ideas/${id}/`, { method: 'DELETE' });
}

export async function fetchBottlesAdmin(): Promise<AdminBottle[]> {
  const res = await apiFetch('bottles/');
  if (!res.ok) throw new Error('Failed to load bottles');
  return res.json();
}

export async function deleteBottle(id: number) {
  return apiFetch(`bottles/${id}/`, { method: 'DELETE' });
}

export async function fetchStoriesAdmin(): Promise<AdminStory[]> {
  const res = await apiFetch('forge/stories/');
  if (!res.ok) throw new Error('Failed to load stories');
  return res.json();
}

export async function deleteStoryAdmin(id: number) {
  return apiFetch(`forge/stories/${id}/`, { method: 'DELETE' });
}

export async function fetchPostsAdmin(): Promise<AdminPost[]> {
  const res = await apiFetch('staff/posts/');
  if (!res.ok) throw new Error('Failed to load posts');
  return res.json();
}

export async function deletePostAdmin(id: number) {
  return apiFetchJson('staff/posts/', { method: 'DELETE', json: { post_id: id } });
}

export async function fetchCommentsAdmin(postId?: number): Promise<AdminComment[]> {
  const suffix = postId ? `?post_id=${postId}` : '';
  const res = await apiFetch(`staff/comments/${suffix}`);
  if (!res.ok) throw new Error('Failed to load comments');
  return res.json();
}

export async function deleteCommentAdmin(id: number) {
  return apiFetchJson('staff/comments/', { method: 'DELETE', json: { comment_id: id } });
}

export async function broadcastNotification(data: { title: string; message: string; user_ids?: number[] }) {
  return apiFetchJson('notifications/broadcast/', { method: 'POST', json: data });
}
