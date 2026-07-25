'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';

const STORAGE_KEY = 'cosmory-cookie-consent';

type Consent = 'all' | 'essential' | null;

export default function CookieConsent() {
  const { theme } = useTheme();
  const { t, dir } = useLocale();
  const [consent, setConsent] = useState<Consent>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === 'all' || raw === 'essential') setConsent(raw);
    } catch {
      /* ignore */
    }
  }, []);

  function persist(value: Exclude<Consent, null>) {
    setConsent(value);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }

  if (!mounted || consent !== null) return null;

  const isDark = theme === 'dark';
  const bg = isDark ? 'rgba(30,23,64,0.96)' : 'rgba(255,255,255,0.96)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.18)';
  const text = isDark ? '#F5F3FF' : '#211B3D';
  const muted = isDark ? '#B0A6D9' : '#79709E';
  const accent = isDark ? '#C4B5FD' : '#7C3AED';
  const accentStrong = isDark ? '#A78BFA' : '#5B21B6';

  return (
    <div
      dir={dir}
      role="dialog"
      aria-live="polite"
      aria-label={t('legal.cookieTitle')}
      className="fixed bottom-0 left-0 right-0 z-[60] px-3 pb-3 md:px-4 md:pb-4"
    >
      <div
        className="mx-auto w-full max-w-3xl rounded-2xl p-4 md:p-5 backdrop-blur-lg shadow-lg"
        style={{ background: bg, border: `1px solid ${border}`, color: text }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold" style={{ color: text }}>
              {t('legal.cookieTitle')}
            </h2>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: muted }}>
              {t('legal.cookieBody')}{' '}
              <Link
                href="/privacy"
                className="underline hover:opacity-80"
                style={{ color: accent }}
              >
                {t('legal.cookieLearnMore')}
              </Link>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => persist('essential')}
              className="rounded-full px-3 py-2 text-xs font-semibold transition hover:opacity-80"
              style={{
                background: 'transparent',
                color: accent,
                border: `1px solid ${accent}`,
              }}
            >
              {t('legal.cookieEssential')}
            </button>
            <button
              type="button"
              onClick={() => persist('all')}
              className="rounded-full px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
              style={{ background: accentStrong }}
            >
              {t('legal.cookieAccept')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
