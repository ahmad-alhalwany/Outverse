import { apiFetch } from './api';

export type CreatorSummary = {
  total_content: number;
  total_posts: number;
  total_signals: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_reposts: number;
  total_reactions: number;
  total_ideas?: number;
  idea_supporters?: number;
  idea_funding_raised?: number;
};

export type CreatorContentBreakdown = {
  total_posts?: number;
  total_signals?: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_reposts?: number;
};

export type CreatorTopItem = {
  type: 'post' | 'reel' | 'idea';
  id: number;
  title: string;
  views: number;
  likes: number;
  shares: number;
  reposts: number;
  score: number;
};

export type CreatorIdeasStats = {
  total_ideas: number;
  total_supporters: number;
  total_funding_raised: number;
  total_pledges: number;
  by_category: Record<string, number>;
};

export type CreatorEngagementDay = {
  date: string;
  day: string;
  shares: number;
  reactions: number;
};

export type CreatorInspirationStats = {
  published: number;
  by_category: Record<string, number>;
  answered_by_category: Record<string, number>;
  skipped_by_category: Record<string, number>;
  preferred_categories: string[];
};

export type CreatorAnalytics = {
  summary: CreatorSummary;
  posts: CreatorContentBreakdown;
  reels: CreatorContentBreakdown;
  ideas?: CreatorIdeasStats;
  shares_by_channel: Record<string, number>;
  reactions_by_type: Record<string, number>;
  inspiration: CreatorInspirationStats;
  engagement_trend: CreatorEngagementDay[];
  top_content: CreatorTopItem[];
};

export async function fetchCreatorAnalytics(): Promise<CreatorAnalytics | null> {
  const res = await apiFetch('analytics/creator/');
  if (!res.ok) return null;
  return res.json();
}
