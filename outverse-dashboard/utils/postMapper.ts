import { formatRelativeTime } from './dateFormatter';
import { mediaUrl } from '@/lib/api';

export { mediaUrl as fullMediaUrl };

function userFullName(user: any) {
  if (user.first_name || user.last_name) {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim();
  }
  return user.username || '';
}

export function mapPost(post: any) {
  const user = post.user
    ? {
        id: post.user.id,
        name: userFullName(post.user),
        avatar: post.user.avatar ? mediaUrl(post.user.avatar) : '',
      }
    : { id: undefined, name: '', avatar: '' };

  const images = post.media
    ? post.media
        .filter((m: any) => m.media_type === 'image')
        .map((m: any) => mediaUrl(m.media_file))
    : [];
  const videos = post.media
    ? post.media
        .filter((m: any) => m.media_type === 'video')
        .map((m: any) => mediaUrl(m.media_file))
    : [];

  const stats = {
    views: post.views || 0,
    comments: post.comments_count || 0,
    shares: post.shares_count || 0,
  };

  return {
    ...post,
    user,
    userId: post.user?.id,
    images,
    videos,
    stats,
    mood: post.mood || '',
    tags: post.tags || [],
    is_saved: !!post.is_saved,
    time: formatRelativeTime(new Date(post.created_at)),
  };
}
