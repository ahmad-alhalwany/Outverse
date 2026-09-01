import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { I18nManager, DevSettings, View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/api/client';
import { createT, type AppLocale } from './index';

const STORAGE_KEY = 'cosonova.locale';

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale, opts?: { persistRemote?: boolean; reloadIfNeeded?: boolean }) => Promise<void>;
  t: ReturnType<typeof createT>;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

async function reloadApp() {
  try {
    const expo = require('expo') as { reloadAppAsync?: () => Promise<void> };
    if (typeof expo.reloadAppAsync === 'function') {
      await expo.reloadAppAsync();
      return;
    }
  } catch {
    /* ignore */
  }
  try {
    DevSettings.reload();
  } catch {
    /* ignore */
  }
}

function applyRtl(locale: AppLocale) {
  const nextRTL = locale === 'ar';
  I18nManager.allowRTL(nextRTL);
  I18nManager.forceRTL(nextRTL);
  return I18nManager.isRTL !== nextRTL;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('en');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && (stored === 'ar' || stored === 'en')) {
          setLocaleState(stored);
          applyRtl(stored);
        }
      } catch {
        /* ignore */
      }
      try {
        const prefs = await api.getPreferences();
        const next = prefs?.locale === 'ar' ? 'ar' : prefs?.locale === 'en' ? 'en' : null;
        if (!cancelled && next) {
          setLocaleState(next);
          await AsyncStorage.setItem(STORAGE_KEY, next);
          applyRtl(next);
        }
      } catch {
        /* signed out or prefs unavailable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback(
    async (
      next: AppLocale,
      opts: { persistRemote?: boolean; reloadIfNeeded?: boolean } = {},
    ) => {
      const persistRemote = opts.persistRemote !== false;
      const reloadIfNeeded = opts.reloadIfNeeded !== false;
      setLocaleState(next);
      await AsyncStorage.setItem(STORAGE_KEY, next);
      if (persistRemote) {
        try {
          await api.updatePreferences({ locale: next });
        } catch {
          /* keep local */
        }
      }
      const needsReload = applyRtl(next);
      if (needsReload && reloadIfNeeded) {
        await reloadApp();
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: createT(locale),
      dir: (locale === 'ar' ? 'rtl' : 'ltr') as 'ltr' | 'rtl',
      isRTL: locale === 'ar',
    }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <View style={[styles.fill, { direction: value.dir }]}>{children}</View>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: 'en' as AppLocale,
      setLocale: async () => {},
      t: createT('en'),
      dir: 'ltr' as const,
      isRTL: false,
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
