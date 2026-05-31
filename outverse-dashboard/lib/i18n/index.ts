import type { AppLocale } from '@/lib/settingsPrefs';
import { ar } from './ar';
import { en, type Messages } from './en';

const catalogs: Record<AppLocale, Messages> = { en: en as Messages, ar };

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
  const messages = catalogs[locale] ?? en;
  return function t(key: string, vars?: Record<string, string | number>): string {
    let text = getByPath(messages as unknown as Record<string, unknown>, key) ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };
}

export { en, ar };
