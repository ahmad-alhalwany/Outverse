/** User preferences stored in localStorage (client-side). */

const PREFIX = 'cosmory-pref-';

export type AppLocale = 'en' | 'ar';

export type SettingsPrefs = {
  /** Show full message on map popup for bottles you threw. */
  showOwnMessageOnMap: boolean;
  /** Blur message previews in the recent bottles sidebar (others' bottles). */
  hideOthersInRecent: boolean;
  /** UI language */
  locale: AppLocale;
  theme: 'light' | 'dark';
  vaultMapStyle: 'street' | 'cosmic';
  notificationPrefs: Record<string, boolean>;
  profileVisibility: 'public' | 'followers' | 'private';
  bottlePrivacy: 'map_only' | 'catch_only' | 'private';
  onlineStatusVisible: boolean;
  readReceiptsEnabled: boolean;
  weirdnessLevel: number;
  messageFrequency: 'hourly' | 'daily' | 'weekly';
  defaultAllowRemix: boolean;
  defaultAllowWeave: boolean;
  defaultAllowDownload: boolean;
  defaultReplyControl: 'everyone' | 'followers' | 'nobody';
};

const DEFAULTS: SettingsPrefs = {
  showOwnMessageOnMap: true,
  hideOthersInRecent: true,
  locale: 'en',
  theme: 'light',
  vaultMapStyle: 'street',
  notificationPrefs: {
    likes: true,
    comments: true,
    follows: true,
    reels: true,
    ideas: true,
    stories: true,
    bottles: true,
    shop: true,
  },
  profileVisibility: 'public',
  bottlePrivacy: 'map_only',
  onlineStatusVisible: true,
  readReceiptsEnabled: true,
  weirdnessLevel: 30,
  messageFrequency: 'daily',
  defaultAllowRemix: true,
  defaultAllowWeave: true,
  defaultAllowDownload: false,
  defaultReplyControl: 'everyone',
};

/** Safe initial state for SSR/first client paint — always the same on both. */
export const DEFAULT_SETTINGS_PREFS: SettingsPrefs = { ...DEFAULTS };

export function readSettingsPrefs(): SettingsPrefs {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(`${PREFIX}all`);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function persistSettingsPrefs(prefs: Partial<SettingsPrefs>) {
  if (typeof window === 'undefined') return;
  const next = { ...readSettingsPrefs(), ...prefs };
  localStorage.setItem(`${PREFIX}all`, JSON.stringify(next));
}
