import React, { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, shadows } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';

export type WorldTone = 'lab' | 'vault' | 'bazaar' | 'story' | 'live' | 'shop' | 'default';

const TONES: Record<WorldTone, { from: string; to: string; accent: string; button: [string, string] }> = {
  lab: { from: '#14102A', to: '#16351C', accent: '#81C784', button: ['#4CAF50', '#2E7D32'] },
  vault: { from: '#14102A', to: '#2A1038', accent: '#CE93D8', button: ['#9C27B0', '#6A1B9A'] },
  bazaar: { from: '#14102A', to: '#0D2744', accent: '#64B5F6', button: ['#2196F3', '#1565C0'] },
  story: { from: '#14102A', to: '#3A1C06', accent: '#FFB74D', button: ['#FF9800', '#E65100'] },
  live: { from: '#14102A', to: '#3B0764', accent: '#F9A8D4', button: ['#9F1239', '#7C3AED'] },
  shop: { from: '#14102A', to: '#3A1020', accent: '#F48FB1', button: ['#E91E63', '#AD1457'] },
  default: { from: '#14102A', to: '#4C1D95', accent: '#C4B5FD', button: ['#7C3AED', '#5B21B6'] },
};

export function WorldBackdrop({
  tone = 'default',
  children,
  style,
}: {
  tone?: WorldTone;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const { isDark, colors } = useTheme();
  const t = TONES[tone];
  if (!isDark) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>
        <LinearGradient
          colors={['rgba(124,58,237,0.10)', 'rgba(243,240,252,0.95)', colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    );
  }
  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      <LinearGradient
        colors={[t.from, t.to, colors.background]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 0.85 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.55 }]}
      />
      {children}
    </View>
  );
}

export function WorldHeader({
  title,
  subtitle,
  onBack,
  right,
  tone = 'default',
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  tone?: WorldTone;
}) {
  const { colors } = useTheme();
  const { t, isRTL } = useLocale();
  const accent = TONES[tone].accent;
  return (
    <View style={styles.header}>
      <View style={[styles.headerRow, isRTL && { flexDirection: 'row-reverse' }]}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [
              styles.iconBtn,
              { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.icon} />
          </Pressable>
        ) : (
          <View style={styles.iconSlot} />
        )}
        <View style={{ flex: 1, alignItems: 'center', minWidth: 0 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.headerSub, { color: accent }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={[styles.iconSlot, { alignItems: 'flex-end', justifyContent: 'center' }]}>
          {right}
        </View>
      </View>
    </View>
  );
}

export function WorldHero({
  eyebrow,
  title,
  body,
  tone = 'default',
  action,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  tone?: WorldTone;
  action?: ReactNode;
}) {
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const heroTitle = isCompact ? 24 : width >= 768 ? 34 : 28;
  const t = TONES[tone];
  return (
    <LinearGradient
      colors={isDark ? [t.from, t.to] : ['#F5F1FE', '#E9E1FA']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.hero,
        shadows.lg,
        { borderColor: isDark ? 'rgba(167,139,250,0.25)' : 'rgba(124,58,237,0.16)', padding: isCompact ? 16 : 22 },
      ]}
    >
      {eyebrow ? <Text style={[styles.eyebrow, { color: t.accent }]}>{eyebrow}</Text> : null}
      <Text style={[styles.heroTitle, { color: isDark ? '#F8F5FF' : '#211B3D', fontSize: heroTitle, lineHeight: heroTitle + 6 }]}>{title}</Text>
      {body ? (
        <Text style={[styles.heroBody, { color: isDark ? 'rgba(245,243,255,0.78)' : '#79709E' }]}>{body}</Text>
      ) : null}
      {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
    </LinearGradient>
  );
}

export function WorldCard({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const { colors, isDark } = useTheme();
  const content = (
    <View
      style={[
        styles.card,
        shadows.md,
        {
          backgroundColor: isDark ? 'rgba(26,22,48,0.88)' : 'rgba(255,255,255,0.82)',
          borderColor: isDark ? 'rgba(167,139,250,0.22)' : 'rgba(124,58,237,0.14)',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
        {content}
      </Pressable>
    );
  }
  return content;
}

export function WorldPill({
  label,
  active,
  onPress,
  tone = 'default',
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: WorldTone;
}) {
  const { colors, isDark } = useTheme();
  const accent = TONES[tone].accent;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: active
            ? isDark
              ? `${accent}33`
              : 'rgba(124,58,237,0.14)'
            : colors.surface,
          borderColor: active ? accent : colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <Text style={{ color: active ? accent : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function WorldPrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  tone = 'default',
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: WorldTone;
}) {
  const busy = !!(disabled || loading);
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy: !!loading }}
      style={({ pressed }) => ({ opacity: busy ? 0.55 : pressed ? 0.9 : 1 })}
    >
      <LinearGradient
        colors={TONES[tone].button}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.primaryBtn, shadows.md]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.primaryBtnText}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function WorldStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        styles.stat,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(124,58,237,0.06)',
          borderColor: isDark ? 'rgba(167,139,250,0.18)' : 'rgba(124,58,237,0.12)',
        },
      ]}
    >
      <Text style={[styles.statValue, { color: colors.primary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  hero: {
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  heroBody: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  stat: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
