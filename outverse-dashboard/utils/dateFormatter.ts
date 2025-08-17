import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

/**
 * تحويل التاريخ إلى نص نسبي (مثال: منذ دقيقة، منذ ساعة)
 * @param date تاريخ (string أو Date)
 * @param locale اللغة (افتراضي enUS)
 */
export function formatRelativeTime(date: Date | string, locale: 'ar' | 'en' = 'en') {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const localeObj = locale === 'ar' ? ar : enUS;
  return formatDistanceToNow(dateObj, { addSuffix: true, locale: localeObj });
} 