export interface AdminDashboardData {
  counts: {
    users: number;
    active_users: number;
    suspended_users: number;
    posts: number;
    reels: number;
    comments: number;
    challenges: number;
    ideas: number;
    bottles: number;
    stories: number;
    shop_items: number;
    notifications: number;
    pending_flags: number;
  };
  shop: {
    orders_today: number;
    revenue_today: number;
    total_orders: number;
    active_products: number;
    featured_products: number;
  };
  weekly_activity: Array<{
    day: string;
    date: string;
    posts: number;
    reels: number;
    comments: number;
    total: number;
  }>;
  mood_calendar: Array<{
    day: number;
    date: string;
    moods: Record<string, number>;
    dominant: string;
    total: number;
  }>;
  creativity_weeks: Array<{ week: string; score: number }>;
  completion_rate: number;
  bottles_caught: number;
  social_score: number;
  top_supporters: Array<{
    id: number;
    points: number;
    user__username: string;
    user__first_name: string;
    user__last_name: string;
  }>;
  achievements: {
    total_slots: number;
    unlocked: number;
    remaining: number;
  };
  recent_flags: Array<{
    id: number;
    type: string;
    content: string;
    reporter: string;
    status: string;
    created_at: string;
  }>;
  flags_by_type: Record<string, number>;
}

export interface AdminProfile {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
  points: number;
  mood_history: unknown[];
  achievements: Array<Record<string, unknown>>;
  status: 'active' | 'suspended';
  is_staff?: boolean;
}

export interface AdminShopItem {
  id: number;
  name: string;
  description: string;
  price: number;
  type: string;
  category: string;
  cover_url: string;
  rating: number;
  sales_count: number;
  is_featured: boolean;
  is_available: boolean;
  created_at: string;
}

export interface AdminChallenge {
  id: number;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  is_daily: boolean;
  is_active: boolean;
  end_date: string;
  created_at: string;
  participants?: number;
}

export interface AdminReel {
  id: number;
  user: { id: number; username: string };
  caption: string;
  views: number;
  likes_count: number;
  comments_count: number;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AdminFlagged {
  id: number;
  type: string;
  content: string;
  reporter: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

export interface AdminIdea {
  id: number;
  title: string;
  description: string;
  category: string;
  status: string;
  cover_url: string;
  supporters: number;
  owner: { id: number; username: string };
  created_at: string;
}

export interface AdminBottle {
  id: number;
  message: string;
  emotion_type: string;
  location_lat?: number | null;
  location_lng?: number | null;
  created_at: string;
  is_opened?: boolean;
  caught_by?: number | null;
}

export interface AdminStory {
  id: number;
  title: string;
  premise: string;
  genre: string;
  status: string;
  max_segments: number;
  segment_count: number;
  contributors_count: number;
  owner: { id?: number; username: string } | null;
  updated_at: string;
}

export interface AdminPost {
  id: number;
  text: string;
  created_at: string;
  comments_count: number;
  likes_count: number;
  shares_count: number;
  user: { id: number; username: string };
}

export interface AdminComment {
  id: number;
  text: string;
  created_at: string;
  post: number;
  user: { id: number; username: string };
}
