'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  InformationCircleIcon,
  LockClosedIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  SpeakerWaveIcon,
  UserCircleIcon,
  UserIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { useTheme } from '@/components/ThemeProvider';
import {
  readSettingsPrefs,
  persistSettingsPrefs,
  type SettingsPrefs,
} from '@/lib/settingsPrefs';
import { useLocale } from '@/components/LocaleProvider';
import { isAuthenticated, logout } from '@/lib/auth';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';

const PALETTES = {
  light: {
    page: '#FCF7F3',
    section: '#F8E8E1',
    card: '#F9D8CC',
    cardStrong: '#A0583D',
    cardSoft: '#F7D2C6',
    text: '#2F241F',
    textMuted: '#7E5E52',
    textSoft: '#A67B6A',
    white: '#FFFFFF',
    border: 'rgba(160,88,61,0.12)',
    track: '#EFD7CF',
    icon: '#A0583D',
  },
  dark: {
    page: '#17131A',
    section: '#241C28',
    card: '#342633',
    cardStrong: '#C07A5D',
    cardSoft: '#43303D',
    text: '#F7EFEA',
    textMuted: '#D1B8AC',
    textSoft: '#B88F7D',
    white: '#2B2230',
    border: 'rgba(255,255,255,0.06)',
    track: '#5A4452',
    icon: '#D89A7E',
  },
} as const;

type Palette = (typeof PALETTES)[keyof typeof PALETTES];

type ThemeOption = {
  id: string;
  label: string;
  active: boolean;
};

type NotificationKey = keyof SettingsPrefs['notificationPrefs'];

function SectionTitle({
  icon: Icon,
  title,
  color,
}: {
  icon: typeof GlobeAltIcon;
  title: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 px-5 pt-5 pb-4">
      <Icon className="h-6 w-6" style={{ color }} />
      <h2 className="text-[1.05rem] font-semibold">{title}</h2>
    </div>
  );
}

function RowLink({
  href,
  icon: Icon,
  label,
  palette,
}: {
  href: string;
  icon: typeof GlobeAltIcon;
  label: string;
  palette: Palette;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl px-4 py-4 transition-transform duration-150 hover:scale-[1.01]"
      style={{ background: palette.card }}
    >
      <span className="flex items-center gap-3 text-[1.05rem]">
        <Icon className="h-5 w-5" style={{ color: palette.icon }} />
        <span>{label}</span>
      </span>
      <ArrowRightIcon className="h-4 w-4" style={{ color: palette.icon }} />
    </Link>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  checked,
  onChange,
  palette,
}: {
  icon: typeof GlobeAltIcon;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  palette: Palette;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="flex items-center gap-3 text-[1.05rem]">
        <Icon className="h-5 w-5" style={{ color: palette.icon }} />
        <span>{label}</span>
      </span>
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className="relative h-8 w-14 rounded-full transition-colors"
        style={{ background: checked ? palette.cardStrong : palette.cardSoft }}
      >
        <span
          className="absolute top-1 h-6 w-6 rounded-full bg-white transition-all"
          style={{ left: checked ? '1.9rem' : '0.25rem' }}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const { locale, setLocale } = useLocale();
  const palette = PALETTES[theme];
  const user = useAuthUser();
  const [prefs, setPrefs] = useState<SettingsPrefs>(readSettingsPrefs());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const localPrefs = readSettingsPrefs();
    setPrefs(localPrefs);

    if (!isAuthenticated()) return;
    apiFetch('preferences/', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null;
        return await res.json();
      })
      .then((data) => {
        if (!data) return;
        const nextPrefs: SettingsPrefs = {
          ...localPrefs,
          locale: data.locale ?? localPrefs.locale,
          theme: data.theme ?? localPrefs.theme,
          vaultMapStyle: data.vault_map_style ?? localPrefs.vaultMapStyle,
          notificationPrefs: data.notification_prefs ?? localPrefs.notificationPrefs,
          profileVisibility: data.profile_visibility ?? localPrefs.profileVisibility,
          bottlePrivacy: data.bottle_privacy ?? localPrefs.bottlePrivacy,
          onlineStatusVisible: data.online_status_visible ?? localPrefs.onlineStatusVisible,
          showOwnMessageOnMap: (data.bottle_privacy ?? localPrefs.bottlePrivacy) !== 'private',
          hideOthersInRecent: (data.bottle_privacy ?? localPrefs.bottlePrivacy) !== 'catch_only',
        };
        setPrefs(nextPrefs);
        persistSettingsPrefs(nextPrefs);
        setLocale(nextPrefs.locale);
      })
      .catch(() => {});
  }, [setLocale]);

  async function syncPreferences(next: SettingsPrefs) {
    persistSettingsPrefs(next);
    if (!isAuthenticated()) return;
    setSaving(true);
    setStatus('');
    try {
      const res = await apiFetchJson('preferences/', {
        method: 'PUT',
        json: {
          locale: next.locale,
          theme: next.theme,
          vault_map_style: next.vaultMapStyle,
          notification_prefs: next.notificationPrefs,
          profile_visibility: next.profileVisibility,
          bottle_privacy: next.bottlePrivacy,
          online_status_visible: next.onlineStatusVisible,
        },
      });
      if (!res.ok) throw new Error('save failed');
      setStatus('Preferences saved');
    } catch {
      setStatus('Saved locally. Backend sync unavailable.');
    } finally {
      setSaving(false);
    }
  }

  function updatePrefs(patch: Partial<SettingsPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    void syncPreferences(next);
  }

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const themeOptions = useMemo<ThemeOption[]>(
    () => [
      { id: 'cosmic', label: 'Cosmic Calm', active: prefs.theme === 'dark' },
      { id: 'nebula', label: 'Nebula Glow', active: false },
      { id: 'stardust', label: 'Stardust Mist', active: false },
      { id: 'aurora', label: 'Aurora Drift', active: prefs.theme === 'light' },
    ],
    [prefs.theme],
  );

  const weirdnessValue = prefs.theme === 'dark' ? 42 : 28;
  const weirdnessPercent = `${weirdnessValue}%`;
  const notificationRows: Array<{
    key: NotificationKey;
    label: string;
    icon: typeof GlobeAltIcon;
  }> = [
    { key: 'likes', label: 'Push Notifications', icon: BellIcon },
    { key: 'comments', label: 'Email Updates', icon: EnvelopeIcon },
    { key: 'stories', label: 'Sound Effects', icon: SpeakerWaveIcon },
    { key: 'follows', label: 'Vibration', icon: BellIcon },
  ];

  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'John Doe';
  const displayEmail = user?.email || 'john.doe@email.com';
  const avatarSrc = user?.avatar ? mediaUrl(user.avatar) : null;

  return (
    <AppShell
      className="min-h-screen"
      style={{ background: palette.page, color: palette.text }}
      maxWidth="max-w-3xl"
      contentClassName="flex-1 min-w-0 w-full px-0 pb-16 md:px-4"
    >
      <div className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[2rem] md:border" style={{ borderColor: palette.border }}>
        <div className="px-5 pb-6 pt-6">
          <div className="mb-8 flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-full p-1"
              aria-label="Back"
            >
              <ArrowLeftIcon className="h-6 w-6" style={{ color: palette.text }} />
            </button>
            <h1 className="text-[2rem] font-semibold tracking-tight">Settings</h1>
          </div>

          <section className="-mx-5 mb-6" style={{ background: palette.section }}>
            <SectionTitle icon={GlobeAltIcon} title="Account" color={palette.icon} />
            <div className="px-5 pb-5">
              <div
                className="flex items-center gap-4 rounded-[1.35rem] px-4 py-4"
                style={{ background: palette.white }}
              >
                <div
                  className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full"
                  style={{ background: palette.card }}
                >
                  {avatarSrc ? (
                    <img src={avatarSrc} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <UserCircleIcon className="h-12 w-12" style={{ color: palette.icon }} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[1.35rem] font-semibold">{displayName}</p>
                  <p className="truncate text-base" style={{ color: palette.textMuted }}>
                    {displayEmail}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <SectionTitle icon={PaintBrushIcon} title="Personalization" color={palette.icon} />
            <div className="px-5 pb-1">
              <div className="mb-5">
                <p className="mb-3 text-[1.05rem] font-semibold">Mood Theme</p>
                <div className="grid grid-cols-2 gap-3">
                  {themeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (option.id === 'cosmic') {
                          updatePrefs({ theme: 'dark' });
                        }
                        if (option.id === 'aurora') {
                          updatePrefs({ theme: 'light' });
                        }
                      }}
                      className="rounded-2xl px-4 py-5 text-left text-[1.05rem] font-semibold"
                      style={{
                        background: option.active ? palette.cardStrong : palette.card,
                        color: option.active ? '#FFFFFF' : palette.icon,
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-2">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[1.05rem] font-semibold">Weirdness Level</p>
                  <button
                    type="button"
                    onClick={() => updatePrefs({ locale: locale === 'en' ? 'ar' : 'en' })}
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ background: palette.card, color: palette.icon }}
                  >
                    {locale === 'en' ? 'EN' : 'AR'}
                  </button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weirdnessValue}
                  onChange={() => {}}
                  className="h-2 w-full appearance-none rounded-full"
                  style={{
                    background: `linear-gradient(to right, ${palette.cardStrong} 0%, ${palette.cardStrong} ${weirdnessPercent}, ${palette.track} ${weirdnessPercent}, ${palette.track} 100%)`,
                  }}
                />
                <div className="mt-2 flex items-center justify-between text-sm" style={{ color: palette.textMuted }}>
                  <span>Mild</span>
                  <span className="font-semibold" style={{ color: palette.text }}>
                    {weirdnessValue}
                  </span>
                  <span>Wild</span>
                </div>
              </div>
            </div>
          </section>

          <section className="-mx-5 mb-6" style={{ background: palette.section }}>
            <SectionTitle icon={BellIcon} title="Notifications" color={palette.icon} />
            <div className="px-5 pb-5">
              {notificationRows.map((row) => (
                <ToggleRow
                  key={row.key}
                  icon={row.icon}
                  label={row.label}
                  checked={Boolean(prefs.notificationPrefs[row.key])}
                  onChange={(next) =>
                    updatePrefs({
                      notificationPrefs: {
                        ...prefs.notificationPrefs,
                        [row.key]: next,
                      },
                    })
                  }
                  palette={palette}
                />
              ))}
              <p className="mt-3 text-sm" style={{ color: palette.textMuted }}>
                {saving ? 'Saving…' : status || 'Preferences sync to your account when available.'}
              </p>
            </div>
          </section>

          <section className="mb-6">
            <SectionTitle icon={ShieldCheckIcon} title="Privacy & Security" color={palette.icon} />
            <div className="space-y-3 px-5 pb-2">
              <RowLink href="/profile/privacy" icon={UserIcon} label="Account Privacy" palette={palette} />
              <RowLink href="/settings/data-usage" icon={EnvelopeIcon} label="Data Usage" palette={palette} />
              <RowLink href="/settings/security" icon={LockClosedIcon} label="Security Settings" palette={palette} />
              <RowLink href="/chat" icon={ChatBubbleLeftRightIcon} label="Message Settings" palette={palette} />
            </div>
          </section>

          <section className="-mx-5 mb-8" style={{ background: palette.section }}>
            <div className="space-y-3 px-5 py-5">
              <RowLink href="/settings/help" icon={InformationCircleIcon} label="Help & Support" palette={palette} />
              <RowLink href="/settings/about" icon={InformationCircleIcon} label="About" palette={palette} />
            </div>
          </section>

          {isAuthenticated() ? (
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-3 rounded-2xl px-4 py-4 text-[1.05rem] font-semibold text-white"
              style={{ background: palette.cardStrong }}
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              Log Out
            </button>
          ) : (
            <Link
              href="/login"
              className="block rounded-2xl px-4 py-4 text-center text-[1.05rem] font-semibold text-white"
              style={{ background: palette.cardStrong }}
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </AppShell>
  );
}