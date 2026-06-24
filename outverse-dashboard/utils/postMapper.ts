import { mediaUrl } from '@/lib/api';

export { mediaUrl as fullMediaUrl };

type PostUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar?: string | null;
};

type PostMedia = {
  media_type: 'image' | 'video' | string;
  media_file: string;
};

type ApiPost = {
  id?: number;
  user?: PostUser | null;
  media?: PostMedia[];
  views?: number;
  comments_count?: number;
  shares_count?: number;
  mood?: string;
  tags?: string[];
  is_saved?: boolean;
  created_at?: string;
  reaction_counts?: Record<string, number>;
  text?: string;
};

export type { ApiPost };

function userFullName(user: PostUser) {
  if (user.first_name || user.last_name) {
    return `${user.first_name || ''} ${user.last_name || ''}`.trim();
  }
  return user.username || '';
}

export function mapPost(post: ApiPost) {
  const user = post.user
    ? {
        id: post.user.id,
        name: userFullName(post.user),
        avatar: post.user.avatar ? mediaUrl(post.user.avatar) : '',
      }
    : { id: undefined, name: '', avatar: '' };

  const images = post.media
    ? post.media
        .filter((media) => media.media_type === 'image')
        .map((media) => mediaUrl(media.media_file))
    : [];
  const videos = post.media
    ? post.media
        .filter((media) => media.media_type === 'video')
        .map((media) => mediaUrl(media.media_file))
    : [];

  const stats = {
    views: post.views || 0,
    comments: post.comments_count || 0,
    shares: post.shares_count || 0,
  };

  return {
    ...post,
    id: post.id,
    text: post.text || '',
    user,
    userId: post.user?.id,
    images,
    videos,
    stats,
    mood: post.mood || '',
    tags: post.tags || [],
    is_saved: !!post.is_saved,
    created_at: post.created_at || '',
    time: post.created_at || '',
  };
}
