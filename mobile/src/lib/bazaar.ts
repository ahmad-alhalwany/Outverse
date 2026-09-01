export type BazaarIdeaUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar?: string | null;
};

export type BazaarIdea = {
  id: number | string;
  title: string;
  description?: string;
  category?: string;
  cover_url?: string;
  status?: string;
  roles_needed?: string[];
  tags?: string[];
  target_date?: string | null;
  funding_goal?: number | null;
  funding_raised?: number;
  supporters?: number;
  owner?: BazaarIdeaUser;
  collaborators?: BazaarIdeaUser[];
  is_voted?: boolean;
  is_saved?: boolean;
  is_owner?: boolean;
  collab_project_id?: number | null;
  silent_unlocked?: boolean;
  collaborators_count?: number;
  discussion_count?: number;
  milestones?: { id?: string; title?: string; done?: boolean; due_date?: string | null }[];
  pledges?: {
    id?: number;
    amount?: number;
    created_at?: string;
    is_anonymous?: boolean;
    user?: BazaarIdeaUser | null;
  }[];
};

export const BAZAAR_CATEGORIES = [
  { key: 'all', en: 'All', ar: 'الكل' },
  { key: 'technology', en: 'Technology', ar: 'تقنية' },
  { key: 'design', en: 'Design', ar: 'تصميم' },
  { key: 'writing', en: 'Writing', ar: 'كتابة' },
  { key: 'art', en: 'Art', ar: 'فن' },
  { key: 'education', en: 'Education', ar: 'تعليم' },
  { key: 'environment', en: 'Environment', ar: 'بيئة' },
  { key: 'health', en: 'Health', ar: 'صحة' },
  { key: 'social', en: 'Social Impact', ar: 'أثر اجتماعي' },
] as const;

export function bazaarCategoryLabel(key: string | undefined, locale: 'en' | 'ar') {
  const row = BAZAAR_CATEGORIES.find((c) => c.key === key);
  if (!row) return key || '';
  return locale === 'ar' ? row.ar : row.en;
}

export function bazaarOwnerName(idea: BazaarIdea, fallback = 'Anonymous') {
  const owner = idea.owner;
  const full = `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim();
  return full || owner?.username || fallback;
}

export function formatIdeaTargetDate(value?: string | null, locale: 'en' | 'ar' = 'en') {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale === 'ar' ? 'ar' : undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function fundingPercent(idea: BazaarIdea) {
  const goal = idea.funding_goal;
  if (!goal) return null;
  return Math.min(100, Math.round(((idea.funding_raised || 0) / goal) * 100));
}
