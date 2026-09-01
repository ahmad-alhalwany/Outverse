import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { goTab } from '@/lib/nav';

export default function FeedHero() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useLocale();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const heroTitle = isCompact ? 24 : width >= 768 ? 34 : 28;
  const greeting = user?.first_name || user?.username || 'Creator';
  const hey = t('mobile.heroHey', { name: greeting });

  return (
    <LinearGradient
      colors={
        isDark
          ? ['rgba(33,24,71,0.96)', 'rgba(25,24,58,0.94)', 'rgba(43,25,82,0.98)']
          : ['rgba(255,255,255,0.98)', 'rgba(249,243,255,0.98)', 'rgba(243,248,255,0.98)']
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { borderColor: isDark ? 'rgba(196,181,253,0.14)' : colors.border }]}
    >
      <View style={[styles.glowPurple, { opacity: isDark ? 0.55 : 0.28 }]} pointerEvents="none" />
      <View style={[styles.glowCyan, { opacity: isDark ? 0.4 : 0.22 }]} pointerEvents="none" />
      <View style={styles.glow} pointerEvents="none" />
      <View style={styles.eyebrow}>
        <Ionicons name="sparkles" size={14} color={colors.vault} />
        <Text style={[styles.eyebrowText, { color: colors.textSecondary }]}>{t('nav.home')}</Text>
      </View>
      <Text style={[styles.title, { color: colors.text, fontSize: heroTitle, lineHeight: heroTitle + 6 }]}>
        {hey}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('mobile.heroSubtitle')}</Text>
      <View style={styles.stats}>
        <View style={[styles.stat, { borderColor: isDark ? 'rgba(196,181,253,0.14)' : colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF' }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>24/7</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('mobile.heroFresh')}</Text>
        </View>
        <View style={[styles.stat, { borderColor: isDark ? 'rgba(196,181,253,0.14)' : colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF' }]}>
          <Text style={[styles.statValue, { color: colors.lab }]}>Live</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t('mobile.heroPulse')}</Text>
        </View>
      </View>
      <View style={[styles.actions, isCompact && styles.actionsCompact]}>
        <Pressable
          onPress={() => navigation.navigate('Create', { mode: 'post' })}
          accessibilityRole="button"
          accessibilityLabel={t('mobile.shareSpark')}
        >
          <LinearGradient colors={['#7C3AED', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaPrimary}>
            <Text style={styles.ctaPrimaryText}>{t('mobile.shareSpark')}</Text>
          </LinearGradient>
        </Pressable>
        <Pressable
          onPress={() => goTab(navigation, 'Profile')}
          style={[styles.ctaSecondary, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF' }]}
        >
          <Text style={[styles.ctaSecondaryText, { color: colors.text }]}>{t('mobile.myProfile')}</Text>
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          style={[styles.ctaIcon, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF' }]}
          accessibilityRole="button"
          accessibilityLabel={t('nav.settings')}
        >
          <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 28,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  glowPurple: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(168,85,247,0.45)',
  },
  glowCyan: {
    position: 'absolute',
    bottom: -70,
    left: -50,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(34,211,238,0.32)',
  },
  glow: {
    position: 'absolute',
    right: -20,
    bottom: -90,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(124,58,237,0.22)',
  },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  eyebrowText: { fontSize: 11, fontWeight: '700', letterSpacing: 3.2, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '800', lineHeight: 34, marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  stat: { flex: 1, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1 },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  actionsCompact: { flexDirection: 'column', alignItems: 'stretch' },
  ctaPrimary: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
  ctaPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  ctaSecondary: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, minHeight: 44, justifyContent: 'center' },
  ctaSecondaryText: { fontSize: 13, fontWeight: '700' },
  ctaIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
