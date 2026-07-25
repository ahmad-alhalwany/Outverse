// Cosmory Mobile App — Core Types

export interface User {
  id: string | number;
  username: string;
  email: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  location?: string;
  avatar?: string;
  cover_image?: string;
  cover_photo?: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_verified?: boolean;
  is_private?: boolean;
  is_following?: boolean;
  is_followed_by?: boolean;
  onboarding_completed?: boolean;
  interests?: string[];
  created_at?: string;
  date_joined?: string;
}

export interface Post {
  id: string | number;
  user: User;
  post_type?: 'normal' | 'poll' | 'question';
  text: string;
  media: PostMedia[];
  views?: number;
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  shares_count: number;
  reaction_counts: Record<string, number>;
  my_reaction: string | null;
  is_saved?: boolean;
  visibility?: 'public' | 'followers' | 'subscribers';
  reply_control?: 'everyone' | 'followers' | 'nobody';
  my_repost?: number | null;
  repost_of?: Post | null;
  poll_options?: { id: number; text: string; order?: number; vote_count?: number }[];
  poll_results?: Record<string, number>;
  my_poll_vote?: number | null;
  location_name?: string;
  location_lat?: number | null;
  location_lng?: number | null;
  thread_root_id?: number | null;
  thread_seq?: number;
  thread_count?: number;
  is_profile_pinned?: boolean;
  profile_pinned_at?: string | null;
  vote_score?: number;
  my_vote?: 'boost' | 'dim' | null;
  is_community_pinned?: boolean;
  is_spoiler?: boolean;
  community?: { id?: number; slug?: string; name?: string } | null;
  created_at: string;
  edited_at?: string;
  tags?: string[];
}

export interface PostMedia {
  id: string | number;
  media_file?: string;
  media_type?: 'image' | 'video' | 'gif' | 'audio';
  file?: string;
  file_type?: 'image' | 'video' | 'gif';
  type?: 'image' | 'video';
  url?: string;
  thumbnail?: string;
  thumbnail_url?: string;
  duration?: number;
  width?: number;
  height?: number;
  order?: number;
  alt_text?: string;
}

export interface Comment {
  id: string | number;
  post: string | number;
  parent?: string | number | null;
  user: User;
  text: string;
  gif_url?: string;
  sticker_url?: string;
  reaction_counts: Record<string, number>;
  my_reaction: string | null;
  is_pinned?: boolean;
  replies?: Comment[];
  created_at: string;
}

export interface Reel {
  id: string | number;
  user: User;
  video: string;
  video_url?: string; // alias
  caption: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views?: number;
  is_liked: boolean;
  is_saved?: boolean;
  allow_remix?: boolean;
  allow_weave?: boolean;
  allow_download?: boolean;
  reaction_counts: Record<string, number>;
  my_reaction: string | null;
  tags?: string[];
  music?: MusicTrack;
  sound_label?: string;
  music_track?: number | null;
  music_track_detail?: MusicTrack | null;
  remix_of?: number | null;
  stitch_of?: number | null;
  captions?: Array<{ start: number; end: number; text: string }>;
  captions_status?: string;
  effect_meta?: {
    backdrop?: string;
    chroma_key?: boolean;
    overlays?: Array<{ emoji: string; x: number; y: number; scale?: number }>;
    overlay_text?: string;
  };
  template_detail?: {
    title?: string;
    overlay_stickers?: Array<{ emoji: string; x: number; y: number; scale?: number }>;
    overlay_text?: string;
    backdrop_preset?: string;
  } | null;
  created_at: string;
}

export interface MusicTrack {
  id: string | number;
  title: string;
  artist: string;
  artist_label?: string;
  audio_url: string;
  cover_url?: string;
  cover_art_url?: string;
  duration: number;
}

export interface Story {
  id: string | number;
  author?: User;
  user?: User;
  media?: string;
  image?: string | null;
  video?: string | null;
  media_type?: 'image' | 'video';
  text?: string;
  viewers_count?: number;
  viewer_count?: number;
  views?: number;
  is_viewed: boolean;
  created_at: string;
  expires_at: string;
}

export interface ReelComment {
  id: string | number;
  reel: string | number;
  parent?: string | number | null;
  user: User;
  text: string;
  created_at: string;
  replies?: ReelComment[];
}

export interface LiveSession {
  id: string | number;
  user: string | User;
  title: string;
  description?: string;
  playback_url?: string | null;
  stream_key?: string | null;
  rtmp_url?: string | null;
  webrtc_publish_url?: string | null;
  status: string;
  is_live?: boolean;
  current_viewers?: number;
  peak_viewers?: number;
  total_views?: number;
  chat_enabled?: boolean;
  started_at?: string | null;
  duration_seconds?: number;
}

export interface LiveChatMessage {
  id: string | number;
  session: string | number;
  user: string;
  text: string;
  created_at: string;
  is_deleted?: boolean;
}

export interface StoryHighlight {
  id: string | number;
  title: string;
  cover_image?: string;
  stories: Story[];
  order: number;
}

export interface Notification {
  id: string | number;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'repost' | 'message' | 'reaction' | 'system';
  actor: User;
  post?: Post;
  comment?: Comment;
  verb?: string;
  target_type?: string;
  target_id?: string;
  target_text?: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: string | number;
  participant: User;
  last_message?: Message;
  unread_count: number;
  updated_at: string;
  created_at?: string;
  is_muted?: boolean;
  is_archived?: boolean;
}

export interface ChatRoom {
  id: string | number;
  name: string;
  member_count: number;
  last_message?: {
    text: string;
    sender_name?: string;
    created_at: string;
  };
  created_at: string;
  is_expired?: boolean;
  question_text?: string | null;
}

export interface Message {
  id: string | number;
  sender: User;
  content: string;
  text?: string; // alias
  media?: PostMedia;
  media_url?: string;
  media_type?: 'image' | 'video';
  is_read: boolean;
  created_at: string;
}

export interface Ad {
  id: number;
  creative: AdCreative;
  placement: 'feed' | 'stories' | 'reels' | 'explore' | 'profile';
}

export interface AdCreative {
  id: number;
  format: 'image' | 'video' | 'carousel' | 'story' | 'reel';
  headline?: string;
  primary_text: string;
  description?: string;
  cta_text?: string;
  landing_url: string;
  media_urls: string[];
  aspect_ratio: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
  has_more?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}