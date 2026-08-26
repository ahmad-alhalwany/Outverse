import { apiFetch, apiFetchJson, apiUrl, mediaUrl } from '@/lib/api';
import type { StoryOverlay, StoryStroke } from '@/lib/storyStudio';

export const STORIES_API = apiUrl('stories/');

export type MentionCandidate = { id: number; username: string; name: string; avatar: string | null };

export async function searchMentionUsers(query: string): Promise<MentionCandidate[]> {
  if (!query.trim()) return [];
  const res = await apiFetch(`users/mentions/?q=${encodeURIComponent(query.trim())}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function mapStoryFromApi(story: Record<string, unknown>) {
  const user = (story.user as Record<string, unknown>) || {};
  let primaryMedia = '';
  const image = story.image;
  const video = story.video;
  if (image) primaryMedia = mediaUrl(String(image));
  else if (video) primaryMedia = mediaUrl(String(video));
  const name =
    user.first_name || user.last_name
      ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
      : String(user.username || 'Creator');
  const media: { type: string; url: string }[] = [];
  if (story.image) media.push({ type: 'image', url: mediaUrl(String(story.image)) });
  if (story.video) media.push({ type: 'video', url: mediaUrl(String(story.video)) });

  return {
    id: story.id as number,
    userId: (user.id as number) ?? (story.user_id as number),
    name: String(name),
    avatar: user.avatar ? mediaUrl(String(user.avatar)) : '',
    status: 'online',
    isNew: !story.is_viewed,
    isActive: false,
    mediaUrl: primaryMedia || media[0]?.url || '',
    text: String(story.text || ''),
    media,
    createdAt: String(story.created_at || ''),
    expiresAt: String(story.expires_at || ''),
    views: (story.views as number) ?? 0,
    viewerCount: (story.viewer_count as number) ?? 0,
    reactionCounts: (story.reaction_counts as Record<string, number>) || {},
    myReaction: (story.my_reaction as string) || null,
    filterStyle: String(story.filter_style || 'none'),
    backgroundStyle: String(story.background_style || ''),
    overlays: (Array.isArray(story.overlays) ? story.overlays : []) as StoryOverlay[],
    drawing: (Array.isArray(story.drawing) ? story.drawing : []) as StoryStroke[],
    mood: String(story.mood || ''),
    unlockAt: story.unlock_at ? String(story.unlock_at) : null,
    isLocked: !!story.is_locked,
    unlocksIn: (story.unlocks_in as number | null) ?? null,
    constellation: (story.constellation as { id: number; title: string } | null) ?? null,
    pollResults: (story.poll_results as PollResults) || {},
    questionResponseCounts: (story.question_response_counts as Record<string, number>) || {},
    audience: String(story.audience || 'everyone'),
    sharedPost: (story.shared_post as SharedPostRef | null) ?? null,
    locationName: String(story.location_name || ''),
    locationLat: typeof story.location_lat === 'number' ? story.location_lat : null,
    locationLng: typeof story.location_lng === 'number' ? story.location_lng : null,
    user: { name: String(name), avatar: user.avatar ? mediaUrl(String(user.avatar)) : '' },
  };
}

export type SharedPostRef = { id: number; username: string; text: string; image: string | null };

export type PollResults = Record<string, { counts: Record<string, number>; total: number; my_vote: number | null }>;

export type StoryItem = ReturnType<typeof mapStoryFromApi>;

export type StoryRing = {
  userId: number;
  name: string;
  avatar: string;
  items: StoryItem[];
  isNew: boolean;
  count: number;
  mood: string;
  isLocked: boolean;
  audience: string;
};

export function groupStoriesByUser(stories: StoryItem[]): { rings: StoryRing[]; flat: StoryItem[] } {
  const byUser = new Map<number, StoryItem[]>();
  for (const s of stories) {
    const uid = s.userId;
    if (!uid) continue;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid)!.push(s);
  }
  const rings: StoryRing[] = [];
  const flat: StoryItem[] = [];
  for (const [, items] of byUser) {
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const latest = items[0];
    rings.push({
      userId: latest.userId,
      name: latest.name,
      avatar: latest.avatar,
      items,
      isNew: items.some((i) => i.isNew),
      count: items.length,
      mood: latest.mood,
      isLocked: latest.isLocked,
      audience: latest.audience,
    });
    flat.push(...items);
  }
  // Unseen rings surface first, mirroring FB/IG story ordering.
  rings.sort((a, b) => Number(b.isNew) - Number(a.isNew));
  return { rings, flat };
}

const MUTED_STORY_USERS_KEY = 'cosonova_muted_story_users';

export function getMutedStoryUserIds(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(MUTED_STORY_USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function muteStoryUser(userId: number) {
  const ids = new Set(getMutedStoryUserIds());
  ids.add(userId);
  window.localStorage.setItem(MUTED_STORY_USERS_KEY, JSON.stringify([...ids]));
}

export function unmuteStoryUser(userId: number) {
  const ids = new Set(getMutedStoryUserIds());
  ids.delete(userId);
  window.localStorage.setItem(MUTED_STORY_USERS_KEY, JSON.stringify([...ids]));
}

export async function fetchStoryRings(): Promise<{ rings: StoryRing[]; flat: StoryItem[] }> {
  const res = await apiFetch('stories/');
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.results || [];
  const muted = new Set(getMutedStoryUserIds());
  const mapped = list
    .map((s: Record<string, unknown>) => mapStoryFromApi(s))
    .filter((s: StoryItem) => !muted.has(s.userId));
  return groupStoriesByUser(mapped);
}

export async function fetchFollowingStoryRings(): Promise<{ rings: StoryRing[]; flat: StoryItem[] }> {
  const res = await apiFetch('stories/following/');
  if (!res.ok) return { rings: [], flat: [] };
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.results || [];
  const muted = new Set(getMutedStoryUserIds());
  const mapped = list
    .map((s: Record<string, unknown>) => mapStoryFromApi(s))
    .filter((s: StoryItem) => !muted.has(s.userId));
  return groupStoriesByUser(mapped);
}

export async function trackStoryView(storyId: number): Promise<void> {
  try {
    await apiFetchJson(`stories/${storyId}/view/`, { method: 'POST' });
  } catch {
    /* ignore */
  }
}

export async function reactToStory(storyId: number, reaction: string | null) {
  const res = await apiFetchJson(`stories/${storyId}/react/`, {
    method: 'POST',
    json: { reaction },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function replyToStory(storyId: number, text: string) {
  const res = await apiFetchJson(`stories/${storyId}/reply/`, {
    method: 'POST',
    json: { text: text.trim() },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchStoryReplies(storyId: number) {
  const res = await apiFetch(`stories/${storyId}/replies/`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function deleteStory(storyId: number): Promise<boolean> {
  const res = await apiFetch(`stories/${storyId}/`, { method: 'DELETE' });
  return res.ok;
}

export async function fetchStoryViewers(storyId: number) {
  const res = await apiFetch(`stories/${storyId}/viewers/`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export type StoryConstellation = {
  id: number;
  title: string;
  created_at: string;
  stories_count: number;
  cover: string | null;
};

export async function createConstellation(title: string): Promise<StoryConstellation | null> {
  const res = await apiFetchJson('story-constellations/', {
    method: 'POST',
    json: { title },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function addStoryToConstellation(constellationId: number, storyId: number): Promise<boolean> {
  const res = await apiFetchJson(`story-constellations/${constellationId}/add-story/`, {
    method: 'POST',
    json: { story_id: storyId },
  });
  return res.ok;
}

export async function saveStoryToConstellation(storyId: number, title?: string): Promise<StoryConstellation | null> {
  const res = await apiFetchJson(`stories/${storyId}/save-to-constellation/`, {
    method: 'POST',
    json: { title: title || '' },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchUserConstellations(userId: number): Promise<StoryConstellation[]> {
  const res = await apiFetch(`story-constellations/?user=${userId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchConstellationStories(constellationId: number): Promise<{ id: number; title: string; items: StoryItem[] }> {
  const res = await apiFetch(`story-constellations/${constellationId}/`);
  if (!res.ok) return { id: constellationId, title: '', items: [] };
  const data = await res.json();
  const items = (Array.isArray(data.stories) ? data.stories : []).map((s: Record<string, unknown>) => mapStoryFromApi(s));
  return { id: data.id, title: data.title, items };
}

export async function submitPollVote(storyId: number, overlayId: string, optionIndex: number) {
  const res = await apiFetchJson(`stories/${storyId}/poll-vote/`, {
    method: 'POST',
    json: { overlay_id: overlayId, option_index: optionIndex },
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ counts: Record<string, number>; total: number; my_vote: number }>;
}

export async function submitQuestionResponse(storyId: number, overlayId: string, text: string): Promise<boolean> {
  const res = await apiFetchJson(`stories/${storyId}/question-response/`, {
    method: 'POST',
    json: { overlay_id: overlayId, text },
  });
  return res.ok;
}

export type StoryQuestionResponseItem = {
  id: number;
  overlay_id: string;
  text: string;
  responder: { id: number; username: string; avatar: string | null };
  created_at: string;
};

export async function fetchQuestionResponses(storyId: number, overlayId: string): Promise<StoryQuestionResponseItem[]> {
  const res = await apiFetch(`stories/${storyId}/question-responses/?overlay_id=${overlayId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Story Archive: every story you've ever posted, regardless of expiry. */
export async function fetchStoryArchive(): Promise<StoryItem[]> {
  const res = await apiFetch('stories/archive/');
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.results || [];
  return list.map((s: Record<string, unknown>) => mapStoryFromApi(s));
}

export type CloseFriendItem = { id: number; username: string; avatar: string | null };

export async function fetchCloseFriends(): Promise<CloseFriendItem[]> {
  const res = await apiFetch('close-friends/');
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function addCloseFriend(friendId: number): Promise<boolean> {
  const res = await apiFetchJson('close-friends/', { method: 'POST', json: { friend_id: friendId } });
  return res.ok;
}

export async function removeCloseFriend(friendId: number): Promise<boolean> {
  const res = await apiFetch(`close-friends/${friendId}/`, { method: 'DELETE' });
  return res.ok;
}

/** Share an existing post as a new story: fetches the post's image as a
 * blob and re-uploads it, linking back via shared_post_id. */
export async function sharePostToStory(
  postId: number,
  imageUrl: string,
  opts?: { text?: string; audience?: 'everyone' | 'close_friends' },
): Promise<boolean> {
  try {
    const blob = await fetch(imageUrl).then((r) => r.blob());
    const form = new FormData();
    form.append('image', blob, 'shared-post.jpg');
    form.append('text', (opts?.text || '').slice(0, 200));
    form.append('overlays', '[]');
    form.append('drawing', '[]');
    form.append('shared_post_id', String(postId));
    form.append('audience', opts?.audience || 'everyone');
    const res = await apiFetch('stories/', { method: 'POST', body: form });
    return res.ok;
  } catch {
    return false;
  }
}

/** Re-broadcast a reel into the user's 24h story ring. */
export async function shareReelToStory(
  reelId: number,
  videoUrl: string,
  opts?: { caption?: string; text?: string; audience?: 'everyone' | 'close_friends' },
): Promise<boolean> {
  try {
    const blob = await fetch(videoUrl).then((r) => r.blob());
    const form = new FormData();
    form.append('video', blob, 'shared-reel.mp4');
    const caption = (opts?.text ?? opts?.caption ?? '').slice(0, 200);
    form.append('text', caption);
    form.append(
      'overlays',
      JSON.stringify([
        {
          id: `reel-link-${reelId}`,
          type: 'text',
          text: `↗ Signal #${reelId}`,
          x: 50,
          y: 88,
          color: '#ffffff',
          fontSize: 28,
          fontWeight: 600,
          align: 'center',
        },
      ]),
    );
    form.append('drawing', '[]');
    form.append('audience', opts?.audience || 'everyone');
    const res = await apiFetch('stories/', { method: 'POST', body: form });
    return res.ok;
  } catch {
    return false;
  }
}
