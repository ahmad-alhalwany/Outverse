export type BazaarIdeaUser = {
  id?: number;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar?: string | null;
};

export type IdeaMilestone = {
  id: string;
  title: string;
  done: boolean;
  due_date?: string | null;
};

export type BazaarIdea = {
  id: number;
  title: string;
  description: string;
  category: string;
  cover_url: string;
  status: string;
  roles_needed: string[];
  tags?: string[];
  target_date?: string | null;
  milestones?: IdeaMilestone[];
  funding_goal: number | null;
  funding_raised: number;
  supporters: number;
  collaboration_request_count?: number;
  discussion_count?: number;
  pledges?: { id: number; amount: number; created_at: string; user: BazaarIdeaUser | null; is_anonymous?: boolean }[];
  owner: BazaarIdeaUser;
  collaborators?: BazaarIdeaUser[];
  collaborators_count: number;
  is_voted?: boolean;
  is_saved?: boolean;
  is_owner?: boolean;
  collab_project_id?: number | null;
  silent_unlocked?: boolean;
  created_at: string;
};

export type BazaarCollaborationRequest = {
  id: number;
  idea: number;
  role: string;
  message: string;
  status: string;
  created_at: string;
  user: BazaarIdeaUser;
  collab_project_id?: number;
  idea_status?: string;
};

export type BazaarIdeaComment = {
  id: number;
  idea: number;
  content: string;
  created_at: string;
  updated_at: string;
  user: BazaarIdea['owner'];
};

export const BAZAAR_CATEGORIES = [
  { key: 'all', labelEn: 'All', labelAr: 'الكل' },
  { key: 'technology', labelEn: 'Technology', labelAr: 'تقنية' },
  { key: 'design', labelEn: 'Design', labelAr: 'تصميم' },
  { key: 'writing', labelEn: 'Writing', labelAr: 'كتابة' },
  { key: 'art', labelEn: 'Art', labelAr: 'فن' },
  { key: 'education', labelEn: 'Education', labelAr: 'تعليم' },
  { key: 'environment', labelEn: 'Environment', labelAr: 'بيئة' },
  { key: 'health', labelEn: 'Health', labelAr: 'صحة' },
  { key: 'social', labelEn: 'Social Impact', labelAr: 'أثر اجتماعي' },
] as const;

export function bazaarCategoryLabel(key: string, locale: 'en' | 'ar') {
  const row = BAZAAR_CATEGORIES.find((c) => c.key === key);
  if (!row) return key;
  return locale === 'ar' ? row.labelAr : row.labelEn;
}

export function bazaarOwnerName(idea: BazaarIdea) {
  const o = idea.owner;
  if (o?.first_name || o?.last_name) {
    return `${o.first_name || ''} ${o.last_name || ''}`.trim();
  }
  return o?.username || 'Anonymous';
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
