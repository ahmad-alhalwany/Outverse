import { ar } from './ar';
import { en } from './en';
import { extrasAr, extrasEn } from './extras';

export type AppLocale = 'en' | 'ar';

type Catalog = Record<string, unknown>;

const catalogs: Record<AppLocale, Catalog> = {
  en: { ...(en as Catalog), ...extrasEn },
  ar: { ...(ar as Catalog), ...extrasAr },
};

function getByPath(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function createT(locale: AppLocale) {
  const messages = catalogs[locale] ?? catalogs.en;
  const fallback = catalogs.en;
  return function t(key: string, vars?: Record<string, string | number>): string {
    let text = getByPath(messages, key) ?? getByPath(fallback, key) ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replaceAll(`{${k}}`, String(v));
      });
    }
    return text;
  };
}

export { en, ar };
