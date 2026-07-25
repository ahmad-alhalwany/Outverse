import React, { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, shadows, borderRadius } from '@/hooks/useTheme';

type WorldTone = 'lab' | 'vault' | 'bazaar' | 'live' | 'shop' | 'default';

const TONES: Record<WorldTone, { from: string; to: string; accent: string }> = {
  lab: { from: '#2A1748', to: '#5B21B6', accent: '#C4B5FD' },
  vault: { from: '#1A1035', to: '#4C1D95', accent: '#A78BFA' },
  bazaar: { from: '#2B1538', to: '#7C3AED', accent: '#DDD6FE' },
  live: { from: '#3B0764', to: '#9F1239', accent: '#F9A8D4' },
  shop: { from: '#1E1B4B', to: '#4338CA', accent: '#A5B4FC' },
  default: { from: '#17122A', to: '#4C1D95', accent: '#C4B5FD' },
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
  const accent = TONES[tone].accent;
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} activeOpacity={0.85}>
            <Text style={{ color: colors.text, fontSize: 18 }}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.iconBtn} />
        )}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.headerSub, { color: accent }]}>{subtitle}</Text> : null}
        </View>
        <View style={[styles.iconBtn, { alignItems: 'flex-end' }]}>{right}</View>
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
  const { colors, isDark } = useTheme();
  const t = TONES[tone];
  return (
    <LinearGradient
      colors={isDark ? [t.from, t.to] : ['#F5F1FE', '#E9E1FA']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, shadows.lg, { borderColor: isDark ? 'rgba(167,139,250,0.25)' : 'rgba(124,58,237,0.16)' }]}
    >
      {eyebrow ? <Text style={[styles.eyebrow, { color: t.accent }]}>{eyebrow}</Text> : null}
      <Text style={[styles.heroTitle, { color: isDark ? '#F8F5FF' : '#211B3D' }]}>{title}</Text>
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
      <TouchableOpacity onPress={onPress} activeOpacity={0.92}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

export function WorldPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const { colors, isDark } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.pill,
        {
          backgroundColor: active
            ? isDark
              ? 'rgba(167,139,250,0.28)'
              : 'rgba(124,58,237,0.14)'
            : colors.surface,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={{ color: active ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function WorldPrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.9}
      style={{ opacity: disabled || loading ? 0.55 : 1 }}
    >
      <LinearGradient
        colors={['#7C3AED', '#5B21B6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.primaryBtn, shadows.md]}
      >
        <Text style={styles.primaryBtnText}>{loading ? '…' : label}</Text>
      </LinearGradient>
    </TouchableOpacity>
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
  iconBtn: {
    width: 40,
    height: 40,
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
  },
  primaryBtn: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
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
