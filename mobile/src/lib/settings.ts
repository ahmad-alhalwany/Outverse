export type SettingsPalette = {
  page: string;
  section: string;
  card: string;
  cardStrong: string;
  cardSoft: string;
  text: string;
  textMuted: string;
  textSoft: string;
  white: string;
  border: string;
  track: string;
  icon: string;
};

export type NotificationPrefs = {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  shop: boolean;
  reels: boolean;
  ideas: boolean;
  stories: boolean;
  bottles: boolean;
};

export type SettingsPrefs = {
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  read_receipts_enabled: boolean;
  weirdness_level: number;
  message_frequency: 'hourly' | 'daily' | 'weekly';
  vault_map_style: 'street' | 'cosmic';
  online_status_visible: boolean;
  notification_prefs: NotificationPrefs;
  locale: 'en' | 'ar';
  default_allow_remix: boolean;
  default_allow_weave: boolean;
  default_allow_download: boolean;
  default_reply_control: 'everyone' | 'followers' | 'nobody';
};

export const DEFAULT_NOTIFS: NotificationPrefs = {
  likes: true,
  comments: true,
  follows: true,
  shop: true,
  reels: true,
  ideas: true,
  stories: true,
  bottles: true,
};

export const DEFAULT_SETTINGS: SettingsPrefs = {
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  read_receipts_enabled: true,
  weirdness_level: 30,
  message_frequency: 'daily',
  vault_map_style: 'street',
  online_status_visible: true,
  notification_prefs: DEFAULT_NOTIFS,
  locale: 'en',
  default_allow_remix: true,
  default_allow_weave: true,
  default_allow_download: false,
  default_reply_control: 'everyone',
};

export function useSettingsPalette(isDark: boolean): SettingsPalette {
  if (isDark) {
    return {
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
    };
  }
  return {
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
  };
}

export function asSettingsPrefs(data: unknown, fallback: SettingsPrefs): SettingsPrefs {
  if (!data || typeof data !== 'object') return fallback;
  const obj = data as Record<string, unknown>;
  const notifs = { ...DEFAULT_NOTIFS, ...((obj.notification_prefs || {}) as Partial<NotificationPrefs>) };
  const freq = obj.message_frequency;
  const reply = obj.default_reply_control;
  return {
    quiet_hours_enabled: Boolean(obj.quiet_hours_enabled ?? obj.quiet_hours_start),
    quiet_hours_start: String(obj.quiet_hours_start || fallback.quiet_hours_start),
    quiet_hours_end: String(obj.quiet_hours_end || fallback.quiet_hours_end),
    read_receipts_enabled: obj.read_receipts_enabled !== false,
    weirdness_level: typeof obj.weirdness_level === 'number' ? obj.weirdness_level : fallback.weirdness_level,
    message_frequency: freq === 'hourly' || freq === 'weekly' ? freq : 'daily',
    vault_map_style: obj.vault_map_style === 'cosmic' ? 'cosmic' : 'street',
    online_status_visible: obj.online_status_visible !== false,
    locale: obj.locale === 'ar' ? 'ar' : 'en',
    default_allow_remix: obj.default_allow_remix !== false,
    default_allow_weave: obj.default_allow_weave !== false,
    default_allow_download: Boolean(obj.default_allow_download),
    default_reply_control: reply === 'followers' || reply === 'nobody' ? reply : 'everyone',
    notification_prefs: {
      likes: notifs.likes !== false,
      comments: notifs.comments !== false,
      follows: notifs.follows !== false,
      shop: notifs.shop !== false,
      reels: notifs.reels !== false,
      ideas: notifs.ideas !== false,
      stories: notifs.stories !== false,
      bottles: notifs.bottles !== false,
    },
  };
}

export function settingsPayload(prefs: SettingsPrefs, theme: 'light' | 'dark') {
  return {
    locale: prefs.locale,
    theme,
    vault_map_style: prefs.vault_map_style,
    notification_prefs: prefs.notification_prefs,
    online_status_visible: prefs.online_status_visible,
    read_receipts_enabled: prefs.read_receipts_enabled,
    weirdness_level: prefs.weirdness_level,
    message_frequency: prefs.message_frequency,
    default_allow_remix: prefs.default_allow_remix,
    default_allow_weave: prefs.default_allow_weave,
    default_allow_download: prefs.default_allow_download,
    default_reply_control: prefs.default_reply_control,
    quiet_hours_start: prefs.quiet_hours_enabled ? prefs.quiet_hours_start : null,
    quiet_hours_end: prefs.quiet_hours_enabled ? prefs.quiet_hours_end : null,
  };
}
