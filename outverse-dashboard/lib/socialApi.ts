import { apiFetch, apiFetchJson } from './api';

export type SocialStatus = {
  is_blocked: boolean;
  is_muted: boolean;
  is_restricted: boolean;
  blocked_by_them: boolean;
};

export type SocialAction = 'block' | 'mute' | 'restrict';

export async function setSocialAction(
  userId: number,
  action: SocialAction,
  undo = false,
): Promise<{ social: SocialStatus } | null> {
  const res = await apiFetch('users/social/', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, action, undo }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function reportUser(
  userId: number,
  reason: string,
  details = '',
): Promise<boolean> {
  const res = await apiFetch('moderation/report-user/', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, reason, details }),
  });
  return res.ok;
}

export type FeedFeedbackType = 'not_interested' | 'see_less' | 'hide_post';

export async function sendFeedFeedback(
  postId: number,
  type: FeedFeedbackType,
): Promise<boolean> {
  const res = await apiFetch(`posts/${postId}/feedback/`, {
    method: 'POST',
    body: JSON.stringify({ type }),
  });
  return res.ok;
}

export type PrivacyPrefs = {
  dm_policy: 'everyone' | 'followers' | 'following' | 'none';
  comment_policy: 'everyone' | 'followers' | 'following' | 'none';
  mention_policy: 'everyone' | 'followers' | 'following' | 'none';
  tag_policy: 'everyone' | 'followers' | 'following' | 'none';
  hidden_words: string[];
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

export async function fetchPrivacyPrefs(): Promise<PrivacyPrefs | null> {
  const res = await apiFetch('preferences/');
  if (!res.ok) return null;
  return res.json();
}

export async function savePrivacyPrefs(prefs: Partial<PrivacyPrefs>): Promise<boolean> {
  const res = await apiFetch('preferences/', {
    method: 'PUT',
    body: JSON.stringify(prefs),
  });
  return res.ok;
}

export type BlockedUser = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
};

export async function fetchSocialList(type: 'blocked' | 'muted' | 'restricted'): Promise<BlockedUser[]> {
  const res = await apiFetch(`users/social/lists/?type=${type}`);
  if (!res.ok) return [];
  return res.json();
}
