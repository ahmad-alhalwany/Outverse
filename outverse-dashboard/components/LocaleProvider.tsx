'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createT } from '@/lib/i18n';
import {
  readSettingsPrefs,
  persistSettingsPrefs,
  type AppLocale,
} from '@/lib/settingsPrefs';

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: ReturnType<typeof createT>;
  dir: 'ltr' | 'rtl';
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function applyDocumentLocale(locale: AppLocale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('en');

  useEffect(() => {
    const prefs = readSettingsPrefs();
    setLocaleState(prefs.locale ?? 'en');
    applyDocumentLocale(prefs.locale ?? 'en');
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    persistSettingsPrefs({ locale: next });
    applyDocumentLocale(next);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: createT(locale),
      dir: (locale === 'ar' ? 'rtl' : 'ltr') as 'ltr' | 'rtl',
    }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: 'en' as AppLocale,
      setLocale: () => {},
      t: createT('en'),
      dir: 'ltr' as const,
    };
  }
  return ctx;
}
