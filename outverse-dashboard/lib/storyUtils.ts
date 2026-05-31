import { apiUrl, mediaUrl } from '@/lib/api';

export const STORIES_API = apiUrl('stories/');

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
    isNew: true,
    isActive: false,
    mediaUrl: primaryMedia || media[0]?.url || '',
    text: String(story.text || ''),
    media,
    createdAt: String(story.created_at || ''),
    views: (story.views as number) ?? 0,
    user: { name: String(name), avatar: user.avatar ? mediaUrl(String(user.avatar)) : '' },
  };
}

export type StoryItem = ReturnType<typeof mapStoryFromApi>;

export type StoryRing = {
  userId: number;
  name: string;
  avatar: string;
  items: StoryItem[];
  isNew: boolean;
  count: number;
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
      isNew: true,
      count: items.length,
    });
    flat.push(...items);
  }
  return { rings, flat };
}

export async function fetchStoryRings(): Promise<{ rings: StoryRing[]; flat: StoryItem[] }> {
  const res = await fetch(STORIES_API);
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.results || [];
  return groupStoriesByUser(list.map((s: Record<string, unknown>) => mapStoryFromApi(s)));
}
