import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  achievementTitle,
  asAchievements,
  asPassportWorlds,
  CATEGORY_ICON,
  categoryLabel,
  groupedAchievements,
  isUnlocked,
  STAMP_EMOJI,
  useAchievementsPalette,
  worldLabel,
  type Achievement,
  type AchievementsPalette,
  type PassportWorld,
} from '@/lib/achievements';

export default function AchievementsScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated, user } = useAuth();
  const { isDark } = useTheme();
  const C = useAchievementsPalette(isDark);
  const { t, isRTL } = useLocale();

  const [items, setItems] = useState<Achievement[]>([]);
  const [passport, setPassport] = useState<PassportWorld[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [shared, setShared] = useState('');
  const [shareFailed, setShareFailed] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!isAuthenticated || !user?.id) {
      setItems([]);
      setPassport([]);
      setError(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const [profile, stamps] = await Promise.all([
        api.getProfileById(user.id),
        api.getWorldPassports().catch(() => null),
      ]);
      setItems(asAchievements(profile));
      setPassport(asPassportWorlds(stamps));
    } catch {
      setItems([]);
      setPassport([]);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const unlocked = items.filter(isUnlocked).length;
  const remaining = Math.max(0, items.length - unlocked);
  const groups = useMemo(() => groupedAchievements(items), [items]);

  const shareAchievement = async (item: Achievement) => {
    const title = achievementTitle(item, t);
    const text = `${title} — ${t('achievements.shareText')}`;
    const id = item.key || title;
    try {
      const result = await Share.share({ title, message: text });
      if (result.action === Share.dismissedAction) return;
      setShared(id);
      setShareFailed('');
      setTimeout(() => setShared(''), 2200);
    } catch {
      setShareFailed(id);
      setShared('');
      setTimeout(() => setShareFailed(''), 2200);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.cream }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          isAuthenticated ? (
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />
          ) : undefined
        }
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={10}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={16} color={C.text2} />
          <Text style={[styles.backText, { color: C.text2 }]}>{t('common.back')}</Text>
        </Pressable>

        <View style={styles.titleRow}>
          <Ionicons name="trophy" size={28} color={C.brown} />
          <Text style={[styles.title, { color: C.brown }]}>{t('achievements.title')}</Text>
        </View>
        <Text style={[styles.subtitle, { color: C.text2 }]}>{t('achievements.subtitle')}</Text>

        {passport.length > 0 ? <PassportStamps worlds={passport} C={C} t={t} /> : null}

        {!isAuthenticated ? (
          <View style={[styles.empty, { backgroundColor: C.card2 }]}>
            <Text style={[styles.emptyText, { color: C.text2 }]}>{t('achievements.signInPrompt')}</Text>
            <Pressable onPress={() => navigation.navigate('Login')} style={[styles.retry, { backgroundColor: C.brownDk }]}>
              <Text style={styles.retryText}>{t('auth.signIn')}</Text>
            </Pressable>
          </View>
        ) : loading && items.length === 0 && !error ? (
          <Text style={[styles.emptyText, { color: C.text2, marginTop: 32 }]}>{t('common.loading')}</Text>
        ) : error ? (
          <View style={[styles.empty, { backgroundColor: C.card2 }]}>
            <Text style={[styles.emptyText, { color: C.text2 }]}>{t('achievements.loadError')}</Text>
            <Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: C.brownDk }]}>
              <Text style={styles.retryText}>{t('achievements.retry')}</Text>
            </Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: C.card2 }]}>
            <Text style={[styles.emptyText, { color: C.text2 }]}>{t('achievements.empty')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.stats}>
              {[
                { label: t('achievements.total'), value: items.length },
                { label: t('achievements.unlocked'), value: unlocked },
                { label: t('achievements.remaining'), value: remaining },
              ].map((stat) => (
                <View key={stat.label} style={[styles.stat, { backgroundColor: C.white, borderColor: C.line }]}>
                  <Text style={[styles.statValue, { color: C.brown }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: C.text2 }]}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {groups.map((group) => (
              <View key={group.category} style={styles.section}>
                <View style={styles.sectionHead}>
                  <Ionicons
                    name={CATEGORY_ICON[group.category] || 'trophy-outline'}
                    size={18}
                    color={C.brown}
                  />
                  <Text style={[styles.sectionTitle, { color: C.text }]}>
                    {categoryLabel(group.category, t)}
                  </Text>
                </View>
                <View style={styles.grid}>
                  {group.items.map((item, index) => {
                    const unlockedBadge = isUnlocked(item);
                    const pct = item.goal ? Math.min(100, Math.round((item.progress / item.goal) * 100)) : 0;
                    const id = item.key || achievementTitle(item, t);
                    return (
                      <View
                        key={`${group.category}-${item.key || index}`}
                        style={[styles.badge, { backgroundColor: C.white, borderColor: C.line }]}
                      >
                        <View
                          style={[
                            styles.iconWrap,
                            { backgroundColor: unlockedBadge ? C.card : C.progressBg },
                          ]}
                        >
                          <Ionicons
                            name="trophy-outline"
                            size={26}
                            color={unlockedBadge ? C.brown : C.lockedIcon}
                          />
                        </View>
                        <Text style={[styles.badgeTitle, { color: C.text }]}>
                          {achievementTitle(item, t)}
                        </Text>
                        <View style={[styles.bar, { backgroundColor: C.progressBg }]}>
                          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: C.brown }]} />
                        </View>
                        <Text style={[styles.progress, { color: C.text2 }]}>
                          {item.progress}/{item.goal}
                        </Text>
                        {unlockedBadge ? (
                          <Pressable
                            onPress={() => void shareAchievement(item)}
                            style={[styles.share, { backgroundColor: C.card2 }]}
                          >
                            <Ionicons name="share-outline" size={13} color={C.brownDk} />
                            <Text style={[styles.shareText, { color: C.brownDk }]}>
                              {shared === id
                                ? t('achievements.shared')
                                : shareFailed === id
                                  ? t('achievements.shareFailed')
                                  : t('achievements.share')}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}

            <Text style={[styles.footer, { color: C.text2 }]}>{t('achievements.completeMorePrompt')}</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PassportStamps({
  worlds,
  C,
  t,
}: {
  worlds: PassportWorld[];
  C: AchievementsPalette;
  t: (key: string) => string;
}) {
  return (
    <View style={[styles.passport, { backgroundColor: C.card, borderColor: C.line }]}>
      <Text style={[styles.passportTitle, { color: C.text }]}>{t('achievements.passportTitle')}</Text>
      <Text style={[styles.passportHint, { color: C.text2 }]}>{t('achievements.passportHint')}</Text>
      <View style={styles.stamps}>
        {worlds.map((world) => (
          <View key={world.key} style={[styles.stamp, { borderColor: C.line }]}>
            <Text style={styles.emoji}>{STAMP_EMOJI[world.key] || '✨'}</Text>
            <Text style={[styles.stampWorld, { color: C.text2 }]}>{worldLabel(world.key, 'world', t)}</Text>
            <Text style={[styles.stampCount, { color: C.brown }]}>{world.count}</Text>
            <Text style={[styles.stampLabel, { color: C.text2 }]}>{worldLabel(world.key, 'worldLabel', t)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, alignSelf: 'flex-start' },
  backText: { fontSize: 14, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', flex: 1 },
  subtitle: { fontSize: 14, lineHeight: 21, marginBottom: 20 },
  empty: { borderRadius: 18, padding: 28, alignItems: 'center' },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  retry: { marginTop: 14, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  stat: { flex: 1, borderRadius: 18, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badge: {
    flexGrow: 1,
    flexBasis: 148,
    minWidth: 148,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badgeTitle: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  bar: { height: 6, width: '100%', borderRadius: 999, overflow: 'hidden', marginTop: 10 },
  barFill: { height: '100%', borderRadius: 999 },
  progress: { fontSize: 11, marginTop: 6 },
  share: {
    marginTop: 10,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  shareText: { fontSize: 12, fontWeight: '700' },
  footer: { fontSize: 13, textAlign: 'center', paddingVertical: 12, lineHeight: 20 },
  passport: { borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 22 },
  passportTitle: { fontSize: 17, fontWeight: '700' },
  passportHint: { fontSize: 13, marginTop: 4, marginBottom: 14 },
  stamps: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stamp: {
    width: '30%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  emoji: { fontSize: 22, marginBottom: 6 },
  stampWorld: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'center' },
  stampCount: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  stampLabel: { fontSize: 11, marginTop: 2, textAlign: 'center' },
});
