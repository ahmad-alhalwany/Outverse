import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useLocale } from '@/i18n/LocaleProvider';

type Challenge = {
  id: number;
  title?: string;
  description?: string;
  type_display?: string;
  difficulty?: string;
};

export default function DailyChallengeBanner() {
  const { t } = useLocale();
  const navigation = useNavigation<any>();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const data = (await api.getDailyChallenge()) as Challenge | null;
        if (data && data.id) setChallenge(data);
      } catch {
        setChallenge(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <View style={styles.skeleton} />;
  }
  if (!challenge) return null;

  return (
    <LinearGradient colors={['#1F2038', '#232445', '#2F2A58']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
      <View style={styles.eyebrow}>
        <Ionicons name="flame" size={14} color="#FDE68A" />
        <Text style={styles.eyebrowText}>{t('mobile.dailyChallenge')}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {challenge.title}
      </Text>
      {challenge.description ? (
        <Text style={styles.body} numberOfLines={2}>
          {challenge.description}
        </Text>
      ) : null}
      {challenge.type_display ? (
        <View style={styles.chip}>
          <Ionicons name="bulb-outline" size={12} color="rgba(255,255,255,0.9)" />
          <Text style={styles.chipText}>
            {challenge.type_display} · {challenge.difficulty || 'open'}
          </Text>
        </View>
      ) : null}
      <Pressable
        onPress={() =>
          navigation.navigate('MainTabs', { screen: 'Daily', params: { challenge: challenge.id } })
        }
        style={styles.cta}
        accessibilityRole="button"
        accessibilityLabel={t('mobile.joinChallenge')}
      >
        <Text style={styles.ctaText}>{t('mobile.joinChallenge')}</Text>
        <Ionicons name="arrow-forward" size={16} color="#7C3AED" />
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    height: 168,
    borderRadius: 28,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  banner: {
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  eyebrowText: {
    color: 'rgba(254,243,199,0.9)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 28 },
  body: { color: 'rgba(255,255,255,0.78)', fontSize: 14, marginTop: 8, lineHeight: 20 },
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chipText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },
  cta: {
    marginTop: 16,
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  ctaText: { color: '#7C3AED', fontWeight: '800', fontSize: 14 },
});
