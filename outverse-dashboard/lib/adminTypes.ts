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
