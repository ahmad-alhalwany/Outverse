import { mediaUrl } from '@/lib/api';
import { publicDisplayName } from '@/lib/publicDisplayName';

export { mediaUrl as fullMediaUrl };

type PostUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  avatar?: string | null;
  badge_verified?: boolean;
  is_following?: boolean;
};

type PostMedia = {
  media_type: 'image' | 'video' | 'audio' | string;
  media_file: string;
  alt_text?: string;
};

type ApiPost = {
  id?: number;
  user?: PostUser | null;
  media?: PostMedia[];
  views?: number;
  comments_count?: number;
  shares_count?: number;
  reposts_count?: number;
  mood?: string;
  tags?: string[];
  is_saved?: boolean;
  created_at?: string;
  reaction_counts?: Record<string, number>;
  text?: string;
  post_type?: 'normal' | 'poll' | 'question';
  poll_options?: { id: number; text: string; order: number; vote_count?: number }[];
  poll_results?: Record<string, number>;
  my_poll_vote?: number | null;
  question_answers_count?: number;
  my_question_answered?: boolean;
  repost_of?: ApiPost | null;
  my_repost?: number | null;
  thread_root_id?: number | null;
  thread_seq?: number;
  thread_count?: number;
  visibility?: 'public' | 'followers';
  reply_control?: 'everyone' | 'followers' | 'nobody';
  edited_at?: string | null;
  vote_score?: number;
  boost_count?: number;
  dim_count?: number;
  my_vote?: 'boost' | 'dim' | null;
  is_boost_active?: boolean;
  shared_reel?: { id?: number; caption?: string; username?: string; video_url?: string | null } | null;
  flair?: string;
  community?: { id?: number; slug?: string; name?: string } | null;
  top_reactors?: { id: number; name: string; username?: string; type?: string }[];
  is_profile_pinned?: boolean;
  profile_pinned_at?: string | null;
  is_community_pinned?: boolean;
  community_pinned_at?: string | null;
  is_spoiler?: boolean;
  crosspost_of?: ApiPost | null;
  location_name?: string;
  location_lat?: number | null;
  location_lng?: number | null;
};

export type { ApiPost };

function userFullName(user: PostUser) {
  return publicDisplayName(
    {
      ...user,
      name: user.display_name || undefined,
    },
    'Traveler',
  );
}

export type EmbeddedPost = {
  id?: number;
  user: { id?: number; name: string; avatar: string; verified?: boolean };
  text: string;
  time: string;
  images: string[];
};

/** Shallow map for a post embedded inside a quote/repost (no recursion). */
function mapEmbedded(post: ApiPost): EmbeddedPost {
  const user = post.user
    ? {
        id: post.user.id,
        name: userFullName(post.user),
        avatar: post.user.avatar ? mediaUrl(post.user.avatar) : '',
        verified: !!post.user.badge_verified,
      }
    : { id: undefined, name: '', avatar: '' };
  const images = post.media
    ? post.media
        .filter((media) => media.media_type === 'image')
        .map((media) => mediaUrl(media.media_file))
    : [];
  return {
    id: post.id,
    user,
    text: post.text || '',
    time: post.created_at || '',
    images,
  };
}

export function mapPost(post: ApiPost) {
  const user = post.user
    ? {
        id: post.user.id,
        name: userFullName(post.user),
        avatar: post.user.avatar ? mediaUrl(post.user.avatar) : '',
        verified: !!post.user.badge_verified,
        is_following: !!post.user.is_following,
      }
    : { id: undefined, name: '', avatar: '', is_following: false };

  const imageMedia = post.media
    ? post.media.filter((media) => media.media_type === 'image')
    : [];
  const images = imageMedia.map((media) => mediaUrl(media.media_file));
  const imageAlts = imageMedia.map((media) => media.alt_text || '');
  const videos = post.media
    ? post.media
        .filter((media) => media.media_type === 'video')
        .map((media) => mediaUrl(media.media_file))
    : [];
  const audio = post.media
    ? post.media
        .filter((media) => media.media_type === 'audio')
        .map((media) => mediaUrl(media.media_file))
    : [];
  const firstAudio = audio[0] || '';

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
    imageAlts,
    videos,
    audio: firstAudio,
    stats,
    mood: post.mood || '',
    tags: post.tags || [],
    is_saved: !!post.is_saved,
    created_at: post.created_at || '',
    time: post.created_at || '',
    post_type: post.post_type || 'normal',
    poll_options: post.poll_options || [],
    poll_results: post.poll_results || {},
    my_poll_vote: post.my_poll_vote ?? null,
    question_answers_count: post.question_answers_count || 0,
    my_question_answered: !!post.my_question_answered,
    reposts_count: post.reposts_count || 0,
    repost_of: post.repost_of ? mapEmbedded(post.repost_of) : null,
    my_repost: post.my_repost ?? null,
    thread_root_id: post.thread_root_id ?? null,
    thread_seq: post.thread_seq || 0,
    thread_count: post.thread_count || 0,
    visibility: post.visibility || 'public',
    reply_control: post.reply_control || 'everyone',
    edited_at: post.edited_at || null,
    top_reactors: post.top_reactors || [],
    is_profile_pinned: !!post.is_profile_pinned,
    profile_pinned_at: post.profile_pinned_at || null,
    is_community_pinned: !!post.is_community_pinned,
    community_pinned_at: post.community_pinned_at || null,
    is_spoiler: !!post.is_spoiler,
    crosspost_of: post.crosspost_of ? mapEmbedded(post.crosspost_of) : null,
    community: post.community || null,
  };
}

export type MappedPost = ReturnType<typeof mapPost>;
