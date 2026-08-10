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
  AdminSellerApplication,
  AdminShopItem,
  AdminStory,
  AdminVerificationRequest,
} from './adminTypes';

/** Backend list endpoints paginate ({count, next, previous, results}); unwrap to a plain array. */
async function unwrapList<T>(res: Response): Promise<T[]> {
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  const res = await apiFetch('analytics/dashboard/');
  if (res.status === 403) throw new Error('STAFF_REQUIRED');
  if (!res.ok) throw new Error('Failed to load dashboard');
  return res.json();
}

export async function fetchAdminProfiles(): Promise<AdminProfile[]> {
  const res = await apiFetch('users/profiles/');
  if (!res.ok) throw new Error('Failed to load users');
  return unwrapList<AdminProfile>(res);
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

export async function toggleShadowBan(userId: number): Promise<{ ok: boolean; is_shadow_banned: boolean }> {
  const res = await apiFetchJson(`users/${userId}/shadow-ban/`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, is_shadow_banned: !!data.is_shadow_banned };
}

export type MarketingSegment = 'all' | 'inactive_30d';

export type MarketingCampaign = {
  id: number;
  subject: string;
  body_html: string;
  segment: MarketingSegment;
  status: 'draft' | 'sending' | 'sent';
  recipient_count: number;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
};

export async function fetchMarketingCampaigns(): Promise<MarketingCampaign[]> {
  const res = await apiFetch('notifications/marketing-campaigns/');
  if (!res.ok) throw new Error('Failed to load campaigns');
  return res.json();
}

export async function createMarketingCampaign(data: {
  subject: string;
  body_html: string;
  segment: MarketingSegment;
}) {
  return apiFetchJson('notifications/marketing-campaigns/', { method: 'POST', json: data });
}

export async function updateMarketingCampaign(
  id: number,
  data: Partial<{ subject: string; body_html: string; segment: MarketingSegment }>,
) {
  return apiFetchJson(`notifications/marketing-campaigns/${id}/`, { method: 'PATCH', json: data });
}

export async function deleteMarketingCampaign(id: number) {
  return apiFetchJson(`notifications/marketing-campaigns/${id}/`, { method: 'DELETE' });
}

export async function previewMarketingCampaign(id: number): Promise<{ recipient_count: number }> {
  const res = await apiFetchJson(`notifications/marketing-campaigns/${id}/preview/`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to preview recipients');
  return res.json();
}

export async function sendMarketingCampaign(id: number) {
  return apiFetchJson(`notifications/marketing-campaigns/${id}/send/`, { method: 'POST' });
}

export async function fetchShopItemsAdmin(): Promise<AdminShopItem[]> {
  const res = await apiFetch('shop/items/');
  if (!res.ok) throw new Error('Failed to load shop items');
  return unwrapList<AdminShopItem>(res);
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
  return unwrapList<AdminChallenge>(res);
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
  return unwrapList<AdminReel>(res);
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
  return unwrapList<AdminFlagged>(res);
}

export async function patchFlagged(id: number, status: 'approved' | 'rejected') {
  return apiFetchJson(`moderation/flagged/${id}/`, {
    method: 'PATCH',
    json: { status },
  });
}

export async function fetchVerificationRequests(): Promise<AdminVerificationRequest[]> {
  const res = await apiFetch('users/admin/verification/');
  if (!res.ok) throw new Error('Failed to load verification requests');
  return unwrapList<AdminVerificationRequest>(res);
}

export async function reviewVerificationRequest(id: number, action: 'approve' | 'reject') {
  return apiFetchJson(`users/admin/verification/${id}/`, {
    method: 'POST',
    json: { action },
  });
}

export async function fetchSellerApplications(): Promise<AdminSellerApplication[]> {
  const res = await apiFetch('users/admin/seller-applications/');
  if (!res.ok) throw new Error('Failed to load seller applications');
  return unwrapList<AdminSellerApplication>(res);
}

export async function reviewSellerApplication(id: number, action: 'approve' | 'reject') {
  return apiFetchJson(`users/admin/seller-applications/${id}/`, {
    method: 'POST',
    json: { action },
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
  return unwrapList<AdminIdea>(res);
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
  return unwrapList<AdminBottle>(res);
}

export async function deleteBottle(id: number) {
  return apiFetch(`bottles/${id}/`, { method: 'DELETE' });
}

export async function fetchStoriesAdmin(): Promise<AdminStory[]> {
  const res = await apiFetch('forge/stories/');
  if (!res.ok) throw new Error('Failed to load stories');
  return unwrapList<AdminStory>(res);
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

export type AdminSubmission = {
  id: number;
  content: string;
  is_approved: boolean;
  submitted_at: string;
  user: { id: number; username: string };
  challenge_title?: string;
};

export async function fetchChallengeSubmissions(challengeId: number): Promise<AdminSubmission[]> {
  const res = await apiFetch(`challenges/${challengeId}/submissions/`);
  if (!res.ok) throw new Error('Failed to load submissions');
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

export async function approveChallengeSubmission(
  challengeId: number,
  submissionId: number,
  isApproved = true,
) {
  return apiFetchJson(`challenges/${challengeId}/submissions/${submissionId}/approve/`, {
    method: 'PATCH',
    json: { is_approved: isApproved },
  });
}

// ── Ads admin ─────────────────────────────────────────────────────────────────

export type AdminAdCreative = {
  id: number;
  name: string;
  format: string;
  status: string;
  headline: string;
  primary_text: string;
  cta_text: string;
  landing_url: string;
  media_urls: string[];
  campaign: {
    id: number;
    name: string;
    advertiser?: { username?: string } | number;
  };
  created_at: string;
  reviewed_at: string | null;
};

export async function fetchAdCreativesAdmin(status?: string): Promise<AdminAdCreative[]> {
  const params = status ? `?status=${status}` : '?status=pending_review';
  const res = await apiFetch(`ads/creatives/${params}`);
  if (!res.ok) throw new Error('Failed to load ad creatives');
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

export async function approveAdCreative(id: number) {
  return apiFetchJson(`ads/creatives/${id}/approve/`, { method: 'POST' });
}

export async function rejectAdCreative(id: number) {
  return apiFetchJson(`ads/creatives/${id}/reject/`, { method: 'POST' });
}
