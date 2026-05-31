export type BazaarIdea = {
  id: number;
  title: string;
  description: string;
  category: string;
  cover_url: string;
  status: string;
  roles_needed: string[];
  funding_goal: number | null;
  funding_raised: number;
  supporters: number;
  owner: {
    id?: number;
    username: string;
    first_name?: string;
    last_name?: string;
    avatar?: string | null;
  };
  collaborators_count: number;
  created_at: string;
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
