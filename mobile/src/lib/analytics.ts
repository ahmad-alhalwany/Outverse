export type AnalyticsPalette = {
  cream: string;
  card: string;
  card2: string;
  white: string;
  brown: string;
  brownDk: string;
  text: string;
  text2: string;
  line: string;
  barBg: string;
  bannerBg: string;
};

export type WeeklyDay = {
  day: string;
  date: string;
  total: number;
};

export type MoodCell = {
  day: number;
  date: string;
  dominant: string | null;
};

export type PersonalAnalytics = {
  creativity_score: number;
  completion_rate: number;
  bottles_caught: number;
  stories_count: number;
  weekly_activity: WeeklyDay[];
  mood_calendar: MoodCell[];
  above_average_pct: number;
  story_genre_breakdown: Record<string, number>;
};

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
};

export type CreatorIdeasStats = {
  total_ideas: number;
  total_supporters: number;
  total_funding_raised: number;
  total_pledges: number;
  by_category: Record<string, number>;
};

export type CreatorInspirationStats = {
  published: number;
  by_category: Record<string, number>;
  preferred_categories: string[];
};

export type CreatorTrendDay = {
  date: string;
  day: string;
  shares: number;
  reactions: number;
};

export type CreatorTopItem = {
  type: 'post' | 'reel' | 'idea';
  id: number;
  title: string;
  views: number;
  likes: number;
  shares: number;
  reposts: number;
};

export type CreatorAnalytics = {
  summary: CreatorSummary;
  ideas: CreatorIdeasStats | null;
  shares_by_channel: Record<string, number>;
  reactions_by_type: Record<string, number>;
  inspiration: CreatorInspirationStats;
  engagement_trend: CreatorTrendDay[];
  top_content: CreatorTopItem[];
};

export const MOOD_EMOJI: Record<string, string> = {
  happy: '😊',
  sad: '😔',
  creative: '✨',
};

export const REACTION_COLORS: Record<string, string> = {
  inspired: '#F59E0B',
  cosmic: '#8B5CF6',
  mindbending: '#06B6D4',
  growing: '#10B981',
  spark: '#EC4899',
};

export const CHANNEL_KEYS: Record<string, string> = {
  copy: 'analytics.channelCopy',
  native: 'analytics.channelNative',
  twitter: 'analytics.channelTwitter',
  whatsapp: 'analytics.channelWhatsapp',
  facebook: 'analytics.channelFacebook',
  telegram: 'analytics.channelTelegram',
  linkedin: 'analytics.channelLinkedin',
  reddit: 'analytics.channelReddit',
  bluesky: 'analytics.channelBluesky',
  email: 'analytics.channelEmail',
  dm: 'analytics.channelDm',
  story: 'analytics.channelStory',
  embed: 'analytics.channelEmbed',
  card: 'analytics.channelCard',
  unknown: 'analytics.channelOther',
};

export const CATEGORY_KEYS: Record<string, string> = {
  historical: 'inspiration.categoryHistorical',
  fantasy: 'inspiration.categoryFantasy',
  scifi: 'inspiration.categoryScifi',
  philosophical: 'inspiration.categoryPhilosophical',
  mystery: 'inspiration.categoryMystery',
  surreal: 'inspiration.categorySurreal',
  everyday: 'inspiration.categoryEveryday',
  emotional: 'inspiration.categoryEmotional',
};

export function useAnalyticsPalette(isDark: boolean): AnalyticsPalette {
  if (isDark) {
    return {
      cream: '#14102A',
      card: '#1E1740',
      card2: '#251B4D',
      white: '#2A2154',
      brown: '#C4B5FD',
      brownDk: '#A78BFA',
      text: '#F5F3FF',
      text2: '#B0A6D9',
      line: 'rgba(167,139,250,0.20)',
      barBg: 'rgba(255,255,255,0.08)',
      bannerBg: '#251B4D',
    };
  }
  return {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    barBg: 'rgba(124,58,237,0.12)',
    bannerBg: '#E9E1FA',
  };
}

function asCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, count]) => {
    const n = asCount(count);
    if (key && n > 0) out[key] = n;
  });
  return out;
}

export function asPersonalAnalytics(data: unknown): PersonalAnalytics | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const weekly = Array.isArray(obj.weekly_activity) ? obj.weekly_activity : [];
  const moods = Array.isArray(obj.mood_calendar) ? obj.mood_calendar : [];
  return {
    creativity_score: asCount(obj.creativity_score),
    completion_rate: asCount(obj.completion_rate),
    bottles_caught: asCount(obj.bottles_caught),
    stories_count: asCount(obj.stories_count),
    weekly_activity: weekly.map((row) => {
      const item = (row || {}) as Record<string, unknown>;
      return {
        day: String(item.day || ''),
        date: String(item.date || ''),
        total: asCount(item.total),
      };
    }),
    mood_calendar: moods.map((row) => {
      const item = (row || {}) as Record<string, unknown>;
      return {
        day: asCount(item.day),
        date: String(item.date || ''),
        dominant: item.dominant ? String(item.dominant) : null,
      };
    }),
    above_average_pct: asCount(obj.above_average_pct),
    story_genre_breakdown: asRecord(obj.story_genre_breakdown),
  };
}

export function asCreatorAnalytics(data: unknown): CreatorAnalytics | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const summary = (obj.summary && typeof obj.summary === 'object' ? obj.summary : {}) as Record<string, unknown>;
  const ideas = obj.ideas && typeof obj.ideas === 'object' ? (obj.ideas as Record<string, unknown>) : null;
  const inspiration = (obj.inspiration && typeof obj.inspiration === 'object' ? obj.inspiration : {}) as Record<string, unknown>;
  const trend = Array.isArray(obj.engagement_trend) ? obj.engagement_trend : [];
  const top = Array.isArray(obj.top_content) ? obj.top_content : [];
  return {
    summary: {
      total_content: asCount(summary.total_content),
      total_posts: asCount(summary.total_posts),
      total_signals: asCount(summary.total_signals),
      total_views: asCount(summary.total_views),
      total_likes: asCount(summary.total_likes),
      total_comments: asCount(summary.total_comments),
      total_shares: asCount(summary.total_shares),
      total_reposts: asCount(summary.total_reposts),
      total_reactions: asCount(summary.total_reactions),
    },
    ideas: ideas
      ? {
          total_ideas: asCount(ideas.total_ideas),
          total_supporters: asCount(ideas.total_supporters),
          total_funding_raised: asCount(ideas.total_funding_raised),
          total_pledges: asCount(ideas.total_pledges),
          by_category: asRecord(ideas.by_category),
        }
      : null,
    shares_by_channel: asRecord(obj.shares_by_channel),
    reactions_by_type: asRecord(obj.reactions_by_type),
    inspiration: {
      published: asCount(inspiration.published),
      by_category: asRecord(inspiration.by_category),
      preferred_categories: Array.isArray(inspiration.preferred_categories)
        ? inspiration.preferred_categories.map((row) => String(row)).filter(Boolean)
        : [],
    },
    engagement_trend: trend.map((row) => {
      const item = (row || {}) as Record<string, unknown>;
      return {
        date: String(item.date || ''),
        day: String(item.day || ''),
        shares: asCount(item.shares),
        reactions: asCount(item.reactions),
      };
    }),
    top_content: top
      .map((row) => {
        const item = (row || {}) as Record<string, unknown>;
        const id = asCount(item.id);
        const type = String(item.type || '');
        if (!id || (type !== 'post' && type !== 'reel' && type !== 'idea')) return null;
        return {
          type,
          id,
          title: String(item.title || '').trim() || `#${id}`,
          views: asCount(item.views),
          likes: asCount(item.likes),
          shares: asCount(item.shares),
          reposts: asCount(item.reposts),
        };
      })
      .filter((row): row is CreatorTopItem => Boolean(row)),
  };
}

export function creatorHasContent(data: CreatorAnalytics): boolean {
  return data.summary.total_content > 0 || Boolean(data.ideas && data.ideas.total_ideas > 0);
}

export function sortedEntries(map: Record<string, number>, limit?: number): [string, number][] {
  const rows = Object.entries(map).sort((a, b) => b[1] - a[1]);
  return limit ? rows.slice(0, limit) : rows;
}
