'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  MapIcon,
  ShieldCheckIcon,
  PaintBrushIcon,
  LanguageIcon,
} from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { useTheme } from '@/components/ThemeProvider';
import {
  readVaultMapStyle,
  persistVaultMapStyle,
  type VaultMapStyle,
} from '@/lib/vaultMapStyle';
import {
  readSettingsPrefs,
  persistSettingsPrefs,
  type SettingsPrefs,
} from '@/lib/settingsPrefs';
import { useLocale } from '@/components/LocaleProvider';
import {
  getCurrentUserId,
  getUser,
  isAuthenticated,
  logout,
} from '@/lib/auth';

const PALETTES = {
  light: {
    cream: '#FBF3EE',
    card: '#F5E4DB',
    white: '#FFFFFF',
    brown: '#A0563B',
    brownDk: '#854330',
    text: '#3D2B22',
    text2: '#9A8278',
    line: 'rgba(160,86,59,0.14)',
  },
  dark: {
    cream: '#1a1a2e',
    card: '#23234a',
    white: '#2a2a45',
    brown: '#c49a6c',
    brownDk: '#a0563b',
    text: '#F5F6FA',
    text2: '#B3B3B3',
    line: 'rgba(106,0,255,0.18)',
  },
};

function Section({
  title,
  icon: Icon,
  children,
  C,
}: {
  title: string;
  icon: typeof MapIcon;
  children: React.ReactNode;
  C: (typeof PALETTES)['light'];
}) {
  return (
    <section
      className="rounded-2xl p-5 mb-4"
      style={{ background: C.white, border: `1px solid ${C.line}` }}
    >
      <h2 className="flex items-center gap-2 text-sm font-bold mb-4" style={{ color: C.text }}>
        <Icon className="h-5 w-5" style={{ color: C.brown }} />
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const C = PALETTES[theme];
  const [mapStyle, setMapStyle] = useState<VaultMapStyle>('street');
  const [prefs, setPrefs] = useState<SettingsPrefs>(() => readSettingsPrefs());
  const user = getUser();

  useEffect(() => {
    setMapStyle(readVaultMapStyle());
    setPrefs(readSettingsPrefs());
  }, []);

  function updatePrefs(patch: Partial<SettingsPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    persistSettingsPrefs(patch);
  }

  function updateMapStyle(next: VaultMapStyle) {
    setMapStyle(next);
    persistVaultMapStyle(next);
  }

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <AppShell
      className="min-h-screen"
      style={{ background: C.cream, color: C.text }}
      maxWidth="max-w-2xl"
      contentClassName="flex-1 min-w-0 w-full px-4 pb-16"
    >
          <h1 className="text-2xl font-bold mb-1" style={{ color: C.brown }}>
            {t('settings.title')}
          </h1>
          <p className="text-sm mb-6" style={{ color: C.text2 }}>
            {t('settings.subtitle')}
          </p>

          <Section title={t('settings.language')} icon={LanguageIcon} C={C}>
            <p className="text-xs mb-3" style={{ color: C.text2 }}>
              {t('settings.languageDesc')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setLocale('en');
                  updatePrefs({ locale: 'en' });
                }}
                className="py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: locale === 'en' ? C.brown : C.card,
                  color: locale === 'en' ? '#fff' : C.text,
                }}
              >
                {t('settings.english')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocale('ar');
                  updatePrefs({ locale: 'ar' });
                }}
                className="py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: locale === 'ar' ? C.brown : C.card,
                  color: locale === 'ar' ? '#fff' : C.text,
                }}
              >
                {t('settings.arabic')}
              </button>
            </div>
          </Section>

          <Section title={t('settings.appearance')} icon={PaintBrushIcon} C={C}>
            <p className="text-xs mb-3" style={{ color: C.text2 }}>
              {t('settings.appearanceDesc')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className="py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: theme === 'light' ? C.brown : C.card,
                  color: theme === 'light' ? '#fff' : C.text,
                }}
              >
                ☀️ {t('settings.light')}
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className="py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: theme === 'dark' ? C.brown : C.card,
                  color: theme === 'dark' ? '#fff' : C.text,
                }}
              >
                🌙 {t('settings.dark')}
              </button>
            </div>
          </Section>

          <Section title={t('settings.emotionMap')} icon={MapIcon} C={C}>
            <p className="text-xs mb-3" style={{ color: C.text2 }}>
              {t('settings.emotionMapDesc')}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                type="button"
                onClick={() => updateMapStyle('street')}
                className="py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: mapStyle === 'street' ? C.brown : C.card,
                  color: mapStyle === 'street' ? '#fff' : C.text,
                }}
              >
                🌍 {t('settings.street')}
              </button>
              <button
                type="button"
                onClick={() => updateMapStyle('cosmic')}
                className="py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: mapStyle === 'cosmic' ? C.brown : C.card,
                  color: mapStyle === 'cosmic' ? '#fff' : C.text,
                }}
              >
                ✨ {t('settings.cosmic')}
              </button>
            </div>
            <Link
              href="/bottles"
              className="block text-center py-2.5 rounded-xl text-sm font-medium"
              style={{ background: C.card, color: C.brown }}
            >
              {t('settings.openVault')}
            </Link>
          </Section>

          <Section title={t('settings.privacy')} icon={ShieldCheckIcon} C={C}>
            <label className="flex items-start gap-3 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.showOwnMessageOnMap}
                onChange={(e) => updatePrefs({ showOwnMessageOnMap: e.target.checked })}
                className="mt-1"
              />
              <span className="text-sm">
                <strong>Show my message on the map</strong>
                <span className="block text-xs mt-0.5" style={{ color: C.text2 }}>
                  Only you see the text when tapping your drifting bottle — others see mood and location
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.hideOthersInRecent}
                onChange={(e) => updatePrefs({ hideOthersInRecent: e.target.checked })}
                className="mt-1"
              />
              <span className="text-sm">
                <strong>Hide others&apos; messages in the sidebar</strong>
                <span className="block text-xs mt-0.5" style={{ color: C.text2 }}>
                  In recent bottles, only your message preview is shown
                </span>
              </span>
            </label>
            <p
              className="text-xs mt-4 p-3 rounded-xl leading-relaxed"
              style={{ background: C.card, color: C.text2 }}
            >
              Strangers&apos; bottles are read via <strong style={{ color: C.text }}>Catch a bottle</strong> only,
              not from the map.
            </p>
          </Section>

          <Section title={t('settings.account')} icon={UserCircleIcon} C={C}>
            {user ? (
              <p className="text-sm mb-3">
                {t('settings.signedIn')} <strong>@{user.username}</strong>
              </p>
            ) : (
              <p className="text-sm mb-3" style={{ color: C.text2 }}>
                {t('settings.notSignedIn')}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Link
                href={`/profile/${getCurrentUserId()}`}
                className="py-2.5 rounded-xl text-center text-sm font-semibold text-white"
                style={{ background: C.brownDk }}
              >
                {t('settings.profile')}
              </Link>
              {!isAuthenticated() && (
                <Link
                  href="/login"
                  className="py-2.5 rounded-xl text-center text-sm font-medium"
                  style={{ background: C.card, color: C.text }}
                >
                  {t('settings.signIn')}
                </Link>
              )}
            </div>
          </Section>

          {isAuthenticated() && (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
              style={{ background: C.card, color: '#c0392b', border: `1px solid ${C.line}` }}
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              {t('settings.signOut')}
            </button>
          )}
    </AppShell>
  );
}
