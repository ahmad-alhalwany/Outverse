/** User preferences stored in localStorage (client-side). */

const PREFIX = 'outverse-pref-';

export type AppLocale = 'en' | 'ar';

export type SettingsPrefs = {
  /** Show full message on map popup for bottles you threw. */
  showOwnMessageOnMap: boolean;
  /** Blur message previews in the recent bottles sidebar (others' bottles). */
  hideOthersInRecent: boolean;
  /** UI language */
  locale: AppLocale;
};

const DEFAULTS: SettingsPrefs = {
  showOwnMessageOnMap: true,
  hideOthersInRecent: true,
  locale: 'en',
};

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
