import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import type { Post } from '@/types';

type RitualPayload = {
  ritual?: { completed?: boolean };
  question?: { id?: number; text?: string; category?: string };
  streak?: number;
};

function periodNow(): 'morning' | 'evening' {
  return new Date().getHours() < 18 ? 'morning' : 'evening';
}

export default function DailyRitualPanel() {
  const { colors, isDark } = useTheme();
  const { t, locale } = useLocale();
  const navigation = useNavigation<any>();
  const period = periodNow();
  const isMorning = period === 'morning';
  const [ritual, setRitual] = useState<RitualPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [completeError, setCompleteError] = useState(false);
  const [pulse, setPulse] = useState<Post[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await api.getDailyQuestion({ period, lang: locale })) as RitualPayload;
      setRitual(data);
    } catch {
      setRitual(null);
    } finally {
      setLoading(false);
    }
  }, [period, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const page = await api.getPosts({ limit: 3, inspiration_only: 1 });
        setPulse(page.results || []);
      } catch {
        setPulse([]);
      }
    })();
  }, []);

  const completed = Boolean(ritual?.ritual?.completed);
  const streak = ritual?.streak ?? 0;

  const handleAnswer = () => {
    navigation.navigate('Create', {
      mode: 'post',
      inspiration: ritual?.question?.text || '',
    });
  };

  const handleComplete = async () => {
    setMarking(true);
    setCompleteError(false);
    try {
      const data = (await api.completeDailyRitual({ period, lang: locale })) as RitualPayload;
      if (data) setRitual(data);
      else setCompleteError(true);
    } catch {
      setCompleteError(true);
    } finally {
      setMarking(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#DED0F7' }]}>
      <LinearGradient
        colors={
          isMorning
            ? isDark
              ? ['#3A2A55', '#6B4590']
              : ['#FDE9C0', '#DDB8FF']
            : isDark
              ? ['#1B1530', '#3A2A6B']
              : ['#2B2543', '#4A3A8B']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <View style={styles.bannerRow}>
          <View style={styles.bannerLeft}>
            <View style={styles.iconBox}>
              <Ionicons name={isMorning ? 'sunny' : 'moon'} size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>
                {t(isMorning ? 'ritual.morningTitle' : 'ritual.eveningTitle')}
              </Text>
              <Text style={styles.bannerSub}>
                {t(isMorning ? 'ritual.morningSubtitle' : 'ritual.eveningSubtitle')}
              </Text>
            </View>
          </View>
          <View style={styles.streak}>
            <Ionicons name="flame" size={14} color="#fff" />
            <Text style={styles.streakText}>
              {streak > 0 ? `${streak} ${t('ritual.streakLabel')}` : t('ritual.streakZero')}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {loading ? (
          <Text style={[styles.muted, { color: colors.textSecondary }]}>{t('ritual.loading')}</Text>
        ) : ritual?.question?.text ? (
          <>
            <Text style={[styles.prompt, { color: colors.text }]}>{ritual.question.text}</Text>
            <Text style={[styles.muted, { color: colors.textSecondary, marginTop: 8 }]}>
              {t('ritual.refreshTomorrow')}
            </Text>
            <View style={styles.actions}>
              <Pressable onPress={handleAnswer} style={[styles.cta, { backgroundColor: isDark ? '#C4B5FD' : '#7C3AED' }]}>
                <Ionicons name="arrow-forward-circle" size={16} color="#fff" />
                <Text style={styles.ctaText}>{t('ritual.cta')}</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleComplete()}
                disabled={marking || completed}
                style={[
                  styles.ghost,
                  {
                    borderColor: completed ? colors.border : isDark ? '#C4B5FD' : '#7C3AED',
                    backgroundColor: completed ? (isDark ? 'rgba(255,255,255,0.06)' : '#E9E1FA') : 'transparent',
                    opacity: marking || completed ? 0.7 : 1,
                  },
                ]}
              >
                {marking ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="checkmark" size={16} color={completed ? colors.textSecondary : colors.primary} />}
                <Text style={{ color: completed ? colors.textSecondary : colors.primary, fontWeight: '700', fontSize: 13 }}>
                  {completed ? t('ritual.completed') : t('ritual.complete')}
                </Text>
              </Pressable>
            </View>
            {completeError ? (
              <Text style={styles.error}>{t('ritual.completeError')}</Text>
            ) : null}
            {pulse.length > 0 ? (
              <View style={[styles.pulse, { borderTopColor: colors.border }]}>
                <Text style={[styles.pulseTitle, { color: colors.textSecondary }]}>{t('ritual.pulseTitle')}</Text>
                {pulse.map((p) => (
                  <Pressable
                    key={String(p.id)}
                    onPress={() => navigation.navigate('PostDetail', { postId: p.id })}
                    style={[styles.pulseRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F3F0FC' }]}
                  >
                    <Text style={[styles.pulseText, { color: colors.text }]} numberOfLines={2}>
                      {p.text || `@${p.user?.username || 'creator'}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[styles.muted, { color: colors.textSecondary }]}>{t('ritual.error')}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, marginBottom: 16 },
  banner: { paddingHorizontal: 16, paddingVertical: 16 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  bannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  streakText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  body: { paddingHorizontal: 16, paddingVertical: 16 },
  prompt: { fontSize: 17, fontWeight: '700', lineHeight: 24 },
  muted: { fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  error: { marginTop: 8, color: '#c0392b', fontSize: 12 },
  pulse: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  pulseTitle: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  pulseRow: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  pulseText: { fontSize: 13, lineHeight: 18 },
});
