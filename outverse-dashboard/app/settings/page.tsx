'use client';

import Link from 'next/link';
import Image from 'next/image';
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
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';
import AccountSecuritySettings from '@/components/settings/AccountSecuritySettings';
import ContentAppealsSettings from '@/components/settings/ContentAppealsSettings';
import BlockedAccountsSettings from '@/components/settings/BlockedAccountsSettings';
import CloseFriendsSettings from '@/components/settings/CloseFriendsSettings';
import InspirationTasteSettings from '@/components/settings/InspirationTasteSettings';
import PrivacyInteractionSettings from '@/components/settings/PrivacyInteractionSettings';
import AppShell from '@/components/AppShell';
import { useTheme } from '@/components/ThemeProvider';
import {
  readSettingsPrefs,
  persistSettingsPrefs,
  DEFAULT_SETTINGS_PREFS,
  type SettingsPrefs,
} from '@/lib/settingsPrefs';
import { useLocale } from '@/components/LocaleProvider';
import { isAuthenticated, logout } from '@/lib/auth';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';

const PALETTES = {
  light: {
    page: '#F3F0FC',
    section: '#E9E1FA',
    card: '#F5F1FE',
    cardStrong: '#7C3AED',
    cardSoft: '#EDE4FB',
    text: '#211B3D',
    textMuted: '#79709E',
    textSoft: '#9691B8',
    white: '#FFFFFF',
    border: 'rgba(124,58,237,0.14)',
    track: '#E3D9F7',
    icon: '#7C3AED',
  },
  dark: {
    page: '#14102A',
    section: '#1E1740',
    card: '#251B4D',
    cardStrong: '#C4B5FD',
    cardSoft: '#2A2154',
    text: '#F5F3FF',
    textMuted: '#B0A6D9',
    textSoft: '#9587C4',
    white: '#2A2154',
    border: 'rgba(255,255,255,0.08)',
    track: '#3A2E66',
    icon: '#C4B5FD',
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
  const { t, locale, setLocale } = useLocale();
  const palette = PALETTES[theme];
  const user = useAuthUser();
  const [prefs, setPrefs] = useState<SettingsPrefs>(DEFAULT_SETTINGS_PREFS);
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
          readReceiptsEnabled: data.read_receipts_enabled ?? localPrefs.readReceiptsEnabled,
          weirdnessLevel: data.weirdness_level ?? localPrefs.weirdnessLevel,
          messageFrequency: data.message_frequency ?? localPrefs.messageFrequency,
          defaultAllowRemix: data.default_allow_remix ?? localPrefs.defaultAllowRemix ?? true,
          defaultAllowWeave: data.default_allow_weave ?? localPrefs.defaultAllowWeave ?? true,
          defaultAllowDownload: data.default_allow_download ?? localPrefs.defaultAllowDownload ?? false,
          defaultReplyControl: data.default_reply_control ?? localPrefs.defaultReplyControl ?? 'everyone',
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
          read_receipts_enabled: next.readReceiptsEnabled,
          weirdness_level: next.weirdnessLevel,
          message_frequency: next.messageFrequency,
          default_allow_remix: next.defaultAllowRemix,
          default_allow_weave: next.defaultAllowWeave,
          default_allow_download: next.defaultAllowDownload,
          default_reply_control: next.defaultReplyControl,
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

  const themeOptions = useMemo<(ThemeOption & { available: boolean })[]>(
    () => [
      { id: 'cosmic', label: 'Cosmic Calm', active: prefs.theme === 'dark', available: true },
      { id: 'nebula', label: 'Nebula Glow', active: false, available: false },
      { id: 'stardust', label: 'Stardust Mist', active: false, available: false },
      { id: 'aurora', label: 'Aurora Drift', active: prefs.theme === 'light', available: true },
    ],
    [prefs.theme],
  );

  const weirdnessValue = prefs.weirdnessLevel;
  const weirdnessPercent = `${weirdnessValue}%`;
  const frequencyOptions: Array<{ id: SettingsPrefs['messageFrequency']; label: string }> = [
    { id: 'hourly', label: 'Frequent' },
    { id: 'daily', label: 'Balanced' },
    { id: 'weekly', label: 'Rare' },
  ];
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
      <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-[2rem] md:border" style={{ borderColor: palette.border }}>
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
                    <Image src={avatarSrc} alt={displayName} width={64} height={64} className="h-full w-full object-cover" unoptimized />
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
                      disabled={!option.available}
                      onClick={() => {
                        if (option.id === 'cosmic') {
                          updatePrefs({ theme: 'dark' });
                        }
                        if (option.id === 'aurora') {
                          updatePrefs({ theme: 'light' });
                        }
                      }}
                      className="rounded-2xl px-4 py-5 text-left text-[1.05rem] font-semibold disabled:cursor-not-allowed"
                      style={{
                        background: option.active ? palette.cardStrong : palette.card,
                        color: option.active ? '#FFFFFF' : option.available ? palette.icon : palette.textSoft,
                        opacity: option.available ? 1 : 0.6,
                      }}
                    >
                      {option.label}
                      {!option.available && (
                        <span className="mt-1 block text-xs font-normal" style={{ color: palette.textSoft }}>
                          {t('common.comingSoon')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-2">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[1.05rem] font-semibold">Weirdness Level</p>
                  <button
                    type="button"
                    onClick={() => {
                      const nextLocale = locale === 'en' ? 'ar' : 'en';
                      setLocale(nextLocale);
                      updatePrefs({ locale: nextLocale });
                    }}
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
                  onChange={(event) => updatePrefs({ weirdnessLevel: Number(event.target.value) })}
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

              <div className="mb-6">
                <InspirationTasteSettings palette={palette} />
              </div>

              <div className="mb-2">
                <p className="mb-3 text-[1.05rem] font-semibold">Bottle & Message Frequency</p>
                <div className="grid grid-cols-3 gap-3">
                  {frequencyOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => updatePrefs({ messageFrequency: option.id })}
                      className="rounded-2xl px-3 py-3 text-center text-sm font-semibold"
                      style={{
                        background: prefs.messageFrequency === option.id ? palette.cardStrong : palette.card,
                        color: prefs.messageFrequency === option.id ? '#FFFFFF' : palette.icon,
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
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
              <button
                type="button"
                className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
                style={{ background: palette.cardStrong }}
                onClick={() => {
                  void (async () => {
                    try {
                      const res = await apiFetch('notifications/push-vapid-key/');
                      const data = res.ok ? await res.json() : { public_key: '' };
                      if (!data.public_key) {
                        setStatus(t('settings.pushNotConfigured'));
                        return;
                      }
                      const mod = await import('@/lib/pushNotifications');
                      const ok = await mod.subscribeToPush(data.public_key);
                      setStatus(ok ? t('settings.pushEnabled') : t('settings.pushUnavailable'));
                    } catch {
                      setStatus(t('settings.pushUnavailable'));
                    }
                  })();
                }}
              >
                {t('settings.enableBrowserPush')}
              </button>
              <p className="mt-3 text-sm" style={{ color: palette.textMuted }}>
                {saving ? 'Saving…' : status || 'Preferences sync to your account when available.'}
              </p>
            </div>
          </section>

          <section className="mb-6">
            <SectionTitle icon={UserGroupIcon} title="Inner Orbit" color={palette.icon} />
            <div className="px-5 pb-2">
              <CloseFriendsSettings />
            </div>
          </section>

          <section className="mb-6">
            <SectionTitle icon={SignalIcon} title={t('signal.publishTitle')} color={palette.icon} />
            <div className="px-5 pb-4 space-y-3">
              <p className="text-sm" style={{ color: palette.textMuted }}>
                {t('signal.publishHint')}
              </p>
              <p className="text-[1.05rem] font-semibold">{t('compose.replyControl')}</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'everyone' as const, label: t('compose.replyEveryone') },
                    { id: 'followers' as const, label: t('compose.replyFollowers') },
                    { id: 'nobody' as const, label: t('compose.replyNobody') },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updatePrefs({ defaultReplyControl: opt.id })}
                    className="rounded-full px-3.5 py-1.5 text-sm font-medium transition"
                    style={{
                      background: prefs.defaultReplyControl === opt.id ? palette.icon : palette.white,
                      color: prefs.defaultReplyControl === opt.id ? '#fff' : palette.text,
                      border: `1px solid ${palette.border}`,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <Link
                href="/orbit-lists"
                className="inline-flex text-sm font-semibold mt-2"
                style={{ color: palette.icon }}
              >
                {t('nav.orbitLists')} →
              </Link>
            </div>
          </section>

          <section className="mb-6">
            <SectionTitle icon={SignalIcon} title={t('reels.pulseCreator')} color={palette.icon} />
            <div className="px-5 pb-4 space-y-1">
              <p className="text-sm mb-3" style={{ color: palette.textMuted }}>
                {t('reels.pulseCreatorHint')}
              </p>
              <ToggleRow
                icon={SignalIcon}
                label={t('reels.allowRemix')}
                checked={prefs.defaultAllowRemix}
                onChange={(next) => updatePrefs({ defaultAllowRemix: next })}
                palette={palette}
              />
              <ToggleRow
                icon={SignalIcon}
                label={t('reels.allowWeave')}
                checked={prefs.defaultAllowWeave}
                onChange={(next) => updatePrefs({ defaultAllowWeave: next })}
                palette={palette}
              />
              <ToggleRow
                icon={SignalIcon}
                label={t('reels.allowExport')}
                checked={prefs.defaultAllowDownload}
                onChange={(next) => updatePrefs({ defaultAllowDownload: next })}
                palette={palette}
              />
              <Link
                href="/reels/discover"
                className="inline-flex text-sm font-semibold mt-3"
                style={{ color: palette.icon }}
              >
                {t('reels.creatorStats')} →
              </Link>
            </div>
          </section>

          <section className="-mx-5 mb-6" style={{ background: palette.section }}>
            <SectionTitle icon={ChatBubbleLeftRightIcon} title="Messaging" color={palette.icon} />
            <div className="px-5 pb-5">
              <ToggleRow
                icon={ChatBubbleLeftRightIcon}
                label="Read receipts"
                checked={prefs.readReceiptsEnabled}
                onChange={(next) => updatePrefs({ readReceiptsEnabled: next })}
                palette={palette}
              />
              <p className="text-sm" style={{ color: palette.icon }}>
                When off, others won&apos;t see when you&apos;ve read their messages.
              </p>
            </div>
          </section>

          <section className="mb-6">
            <SectionTitle icon={LockClosedIcon} title={t('security.title')} color={palette.icon} />
            <div className="space-y-4">
              <ContentAppealsSettings palette={palette} />
              <AccountSecuritySettings palette={palette} />
            </div>
          </section>

          <section className="mb-6">
            <SectionTitle icon={ShieldCheckIcon} title={t('social.privacyTitle')} color={palette.icon} />
            <PrivacyInteractionSettings palette={palette} />
          </section>

          <section className="mb-6">
            <SectionTitle icon={UserGroupIcon} title={t('social.blockedAccountsTitle')} color={palette.icon} />
            <BlockedAccountsSettings />
          </section>

          <section className="mb-6">
            <SectionTitle icon={InformationCircleIcon} title="Legal" color={palette.icon} />
            <div className="space-y-3 px-5 pb-2">
              <RowLink href="/privacy" icon={LockClosedIcon} label={t('legal.privacyTitle')} palette={palette} />
              <RowLink href="/terms" icon={InformationCircleIcon} label={t('legal.termsTitle')} palette={palette} />
              <RowLink href="/chat" icon={ChatBubbleLeftRightIcon} label="Message Settings" palette={palette} />
            </div>
          </section>

          {user ? (
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