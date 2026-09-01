import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { openProfile } from '@/lib/nav';

const PALETTES = {
  light: {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    overlay: 'rgba(33,27,61,0.45)',
    successBg: '#e8f3ee',
    successText: '#2f8f6b',
    dailyGradient: ['#E9E1FA', '#DED0F7'] as const,
    countdownBg: 'rgba(255,255,255,0.72)',
    responseBg: '#FFFFFF',
    submitBg: '#7C3AED',
    submitText: '#FFFFFF',
    pillBg: 'rgba(248, 209, 197, 0.55)',
    historyBg: 'rgba(255,255,255,0.72)',
  },
  dark: {
    cream: '#14102A',
    card: '#1E1740',
    card2: '#251B4D',
    white: '#2A2154',
    brown: '#C4B5FD',
    brownDk: '#A78BFA',
    text: '#F5F3FF',
    text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
    overlay: 'rgba(10,8,24,0.65)',
    successBg: 'rgba(74,222,128,0.15)',
    successText: '#4ade80',
    dailyGradient: ['#3A2A6B', '#251B4D'] as const,
    countdownBg: 'rgba(255,255,255,0.35)',
    responseBg: 'rgba(42, 42, 69, 0.92)',
    submitBg: '#A78BFA',
    submitText: '#1a1a2e',
    pillBg: 'rgba(42, 42, 69, 0.82)',
    historyBg: 'rgba(42, 42, 69, 0.72)',
  },
};

const CATEGORIES: Array<{ key: string; labelKey: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'all', labelKey: 'lab.categoryAll', icon: 'information-circle-outline' },
  { key: 'writing', labelKey: 'lab.categoryWriting', icon: 'pencil-outline' },
  { key: 'art', labelKey: 'lab.categoryArt', icon: 'color-palette-outline' },
  { key: 'music', labelKey: 'lab.categoryMusic', icon: 'musical-notes-outline' },
  { key: 'experimental', labelKey: 'lab.categoryExperimental', icon: 'flame-outline' },
  { key: 'practical', labelKey: 'lab.categoryPractical', icon: 'trophy-outline' },
];

type LabPalette = (typeof PALETTES)[keyof typeof PALETTES];
type TFn = (key: string, vars?: Record<string, string | number>) => string;

type Challenge = {
  id: number;
  title: string;
  description: string;
  type: string;
  type_display?: string;
  difficulty: string;
  cover_url?: string;
  is_daily?: boolean;
  is_ai_generated?: boolean;
  is_owner?: boolean;
  created_by?: {
    id?: number;
    username: string;
    first_name?: string;
    last_name?: string;
    avatar?: string | null;
  } | null;
  end_date?: string;
  participants: number;
};

type ChallengeSubmission = {
  id: number;
  content: string;
  submitted_at?: string;
  created_at?: string;
  is_approved: boolean;
  user: {
    id?: number;
    username: string;
    first_name?: string;
    last_name?: string;
    avatar?: string | null;
  };
};

type RelayUser = {
  id: number;
  username: string;
  name?: string;
  avatar?: string | null;
  overlap?: string[];
};

type Stats = { participants: number; success_rate: number; challenges: number };

function useLabPalette(): LabPalette {
  const { isDark } = useTheme();
  return isDark ? PALETTES.dark : PALETTES.light;
}

function typeLabel(key: string, t: TFn) {
  const cat = CATEGORIES.find((c) => c.key === key);
  return cat ? t(cat.labelKey) : key;
}

function difficultyLabel(key: string, t: TFn) {
  if (key === 'easy') return t('lab.difficultyEasy');
  if (key === 'medium') return t('lab.difficultyMedium');
  if (key === 'hard') return t('lab.difficultyHard');
  return key;
}

function challengeName(user: ChallengeSubmission['user'] | Challenge['created_by'], anonymous: string) {
  if (!user) return anonymous;
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return full || user.username || anonymous;
}

function formatDate(value: string | undefined, justNow: string) {
  if (!value) return justNow;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return justNow;
  return date.toLocaleString();
}

function apiErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data) return '';
  if (typeof data.error === 'string') return data.error;
  if (typeof data.detail === 'string') return data.detail;
  const cover = data.cover_image;
  if (Array.isArray(cover) && typeof cover[0] === 'string') return cover[0];
  return '';
}

function useCountdown(target?: string) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!target || !now) return '--:--:--';
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return '00:00:00';
  const h = Math.floor(diff / 3.6e6);
  const m = Math.floor((diff % 3.6e6) / 6e4);
  const s = Math.floor((diff % 6e4) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function periodNow(): 'morning' | 'evening' {
  return new Date().getHours() < 18 ? 'morning' : 'evening';
}

export default function LabScreen() {
  const C = useLabPalette();
  const { t, locale } = useLocale();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuth();
  const showBack = route.name !== 'Daily';
  const challengeParam = route.params?.challenge;

  const [daily, setDaily] = useState<Challenge | null>(null);
  const [archive, setArchive] = useState<Challenge[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [archivePage, setArchivePage] = useState(1);
  const [archiveHasMore, setArchiveHasMore] = useState(false);
  const [archiveLoadingMore, setArchiveLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [linkError, setLinkError] = useState('');
  const [ritualStreak, setRitualStreak] = useState<number | null>(null);
  const [ritualCompleted, setRitualCompleted] = useState(false);
  const [ritualQuestionId, setRitualQuestionId] = useState<number | null>(null);
  const [relayUsers, setRelayUsers] = useState<RelayUser[]>([]);
  const [completingRitual, setCompletingRitual] = useState(false);
  const [viewChallenge, setViewChallenge] = useState<Challenge | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const countdown = useCountdown(daily?.end_date);

  const loadArchive = useCallback(
    async (page: number, append: boolean) => {
      const data = await api.getChallenges({ type: category, page, page_size: 12 });
      if (Array.isArray(data)) {
        setArchive((prev) => (append ? [...prev, ...data] : data));
        setArchiveHasMore(data.length >= 12);
        setArchivePage(page);
        return;
      }
      const results = Array.isArray(data?.results) ? (data.results as Challenge[]) : [];
      setArchive((prev) => (append ? [...prev, ...results] : results));
      setArchiveHasMore(Boolean(data?.has_more));
      setArchivePage(data?.page ?? page);
    },
    [category],
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      setLoadError(false);
      try {
        if (isAuthenticated) {
          try {
            const ritual = await api.getDailyQuestion({ period: periodNow(), lang: locale });
            setRitualStreak(typeof ritual?.streak === 'number' ? ritual.streak : 0);
            setRitualCompleted(Boolean(ritual?.ritual?.completed));
            setRitualQuestionId(ritual?.question?.id ?? null);
          } catch {
            setRitualStreak(null);
            setRitualCompleted(false);
          }
        } else {
          setRitualStreak(null);
          setRitualCompleted(false);
        }

        let ok = true;
        try {
          const d = await api.ensureDailyChallenge(locale);
          setDaily(d && d.id ? d : null);
        } catch {
          try {
            const fallback = await api.getDailyChallenge();
            setDaily(fallback && fallback.id ? fallback : null);
          } catch {
            setDaily(null);
            ok = false;
          }
        }
        try {
          setStats(await api.getChallengeStats());
        } catch {
          ok = false;
        }
        await loadArchive(1, false);
        if (!ok) setLoadError(true);
      } catch {
        setDaily(null);
        setArchive([]);
        setLoadError(true);
      } finally {
        setLoading(false);
        if (isRefresh) setRefreshing(false);
      }
    },
    [isAuthenticated, loadArchive, locale],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!challengeParam) return;
    const num = parseInt(String(challengeParam), 10);
    if (Number.isNaN(num)) return;
    void (async () => {
      try {
        const data = await api.getChallenge(num);
        if (data?.id) setViewChallenge(data);
        else setLinkError(t('lab.challengeNotFound'));
      } catch {
        setLinkError(t('lab.challengeLoadFailedConnection'));
      }
    })();
  }, [challengeParam, t]);

  const filteredArchive = useMemo(() => {
    const query = search.trim().toLowerCase();
    return archive.filter((challenge) => {
      const matchesQuery =
        !query ||
        (challenge.title || '').toLowerCase().includes(query) ||
        (challenge.description || '').toLowerCase().includes(query);
      const matchesCategory = category === 'all' || challenge.type === category;
      return matchesQuery && matchesCategory;
    });
  }, [archive, category, search]);

  const onChallengeSubmitted = useCallback((challengeId: number, participants: number) => {
    setDaily((current) => (current && current.id === challengeId ? { ...current, participants } : current));
    setArchive((list) =>
      list.map((challenge) => (challenge.id === challengeId ? { ...challenge, participants } : challenge)),
    );
    setViewChallenge((current) => (current && current.id === challengeId ? { ...current, participants } : current));
  }, []);

  const completeRitual = async () => {
    if (!isAuthenticated || completingRitual) return;
    setCompletingRitual(true);
    try {
      const data = await api.completeDailyRitual({ period: periodNow(), lang: locale });
      if (data) {
        setRitualCompleted(Boolean(data.ritual?.completed));
        setRitualStreak(typeof data.streak === 'number' ? data.streak : ritualStreak);
        const qid = data.question?.id ?? ritualQuestionId;
        if (qid) setRelayUsers(await api.relayQuestion(qid));
      }
    } finally {
      setCompletingRitual(false);
    }
  };

  const submitDaily = async () => {
    if (!daily || !response.trim()) {
      setError(t('lab.writeSomethingFirst'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.submitChallengeEntry(daily.id, response.trim());
      setSubmitted(true);
      setResponse('');
      onChallengeSubmitted(daily.id, (daily.participants || 0) + 1);
      setTimeout(() => setSubmitted(false), 3500);
    } catch (e) {
      const msg = apiErrorMessage(e);
      if (msg && /already submitted/i.test(msg)) {
        setSubmitted(true);
        setResponse('');
        setTimeout(() => setSubmitted(false), 3500);
      } else {
        setError(msg && msg !== 'failed' ? msg : t('lab.couldNotSubmitConnection'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const loadMoreArchive = async () => {
    if (archiveLoadingMore || !archiveHasMore) return;
    setArchiveLoadingMore(true);
    try {
      await loadArchive(archivePage + 1, true);
    } catch {
      setLoadError(true);
    } finally {
      setArchiveLoadingMore(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: C.cream }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: insets.bottom + (showBack ? 32 : 108),
            gap: 16,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(true);
              }}
              tintColor={C.brown}
              colors={[C.brown]}
            />
          }
        >
          <View style={styles.topbar}>
            <View style={{ flex: 1 }}>
              {showBack ? (
                <Pressable
                  onPress={() => navigation.goBack()}
                  hitSlop={8}
                  style={[styles.backBtn, { backgroundColor: C.white, borderColor: C.line }]}
                >
                  <Ionicons name="chevron-back" size={18} color={C.brown} />
                  <Text style={{ color: C.brown, fontWeight: '700', fontSize: 13 }}>{t('common.back')}</Text>
                </Pressable>
              ) : null}
              <Text style={[styles.eyebrow, { color: C.brown }]}>{t('lab.worldsLab')}</Text>
              <Text style={[styles.title, { color: C.text }]}>{t('lab.dailyChallenge')}</Text>
              <Text style={[styles.subtitle, { color: C.text2 }]}>{t('lab.letCreativityFlow')}</Text>
            </View>
            <View style={styles.topActions}>
              {ritualStreak !== null ? (
                <View style={[styles.streakPill, { backgroundColor: C.card2, borderColor: C.line }]}>
                  <Ionicons name="flame" size={16} color={C.brown} />
                  <Text style={{ color: C.text, fontWeight: '600', fontSize: 13, flexShrink: 1 }}>
                    {ritualStreak > 0 ? t('lab.dayStreak', { count: String(ritualStreak) }) : t('lab.startStreakToday')}
                    {ritualCompleted ? ` ${t('lab.doneToday')}` : ''}
                  </Text>
                </View>
              ) : null}
              {ritualQuestionId && !ritualCompleted && isAuthenticated ? (
                <Pressable
                  onPress={() => void completeRitual()}
                  disabled={completingRitual}
                  style={[styles.ritualBtn, { backgroundColor: C.brownDk, opacity: completingRitual ? 0.7 : 1 }]}
                >
                  <Text style={styles.ritualBtnText}>
                    {completingRitual ? t('lab.completingRitual') : t('lab.completeDailyRitual')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => navigation.navigate('LabHistory')}
                style={[styles.historyLink, { backgroundColor: C.historyBg, borderColor: C.line }]}
              >
                <Text style={{ color: C.brown, fontWeight: '700', fontSize: 13 }}>{t('lab.historyTitle')}</Text>
              </Pressable>
            </View>
          </View>

          {relayUsers.length > 0 ? (
            <View style={[styles.relayCard, { backgroundColor: C.card, borderColor: C.line }]}>
              <Text style={[styles.relayTitle, { color: C.text }]}>{t('lab.relayTitle')}</Text>
              <Text style={[styles.relayHint, { color: C.text2 }]}>{t('lab.relayHint')}</Text>
              {relayUsers.map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => openProfile(navigation, u.username, user?.username)}
                  style={styles.relayRow}
                >
                  {u.avatar ? (
                    <Image source={{ uri: mediaUrl(u.avatar) }} style={styles.relayAvatar} />
                  ) : (
                    <View style={[styles.relayAvatar, styles.relayAvatarFallback, { backgroundColor: C.line }]}>
                      <Text style={{ color: C.text, fontWeight: '800' }}>
                        {(u.name || u.username || '?')[0]?.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }}>{u.name || u.username}</Text>
                    {u.overlap?.length ? (
                      <Text style={{ color: C.text2, fontSize: 12 }}>{u.overlap.slice(0, 3).join(' · ')}</Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {linkError ? (
            <View style={[styles.linkError, { backgroundColor: C.card2, borderColor: C.line }]}>
              <Text style={{ color: C.text2, flex: 1, fontSize: 13 }}>{linkError}</Text>
              <Pressable onPress={() => setLinkError('')}>
                <Text style={{ color: C.brownDk, fontWeight: '700' }}>{t('lab.dismiss')}</Text>
              </Pressable>
            </View>
          ) : null}

          {loading ? (
            <View style={[styles.stateCard, { backgroundColor: C.card2 }]}>
              <ActivityIndicator color={C.brown} />
              <Text style={{ color: C.text2, marginTop: 10 }}>{t('lab.loadingTodaysChallenge')}</Text>
            </View>
          ) : loadError ? (
            <View style={[styles.stateCard, { backgroundColor: C.card2, borderColor: C.line, borderWidth: 1 }]}>
              <Text style={{ color: C.text, fontWeight: '700', marginBottom: 10 }}>{t('lab.couldNotLoadLab')}</Text>
              <Pressable onPress={() => void load()} style={[styles.retryBtn, { backgroundColor: C.brownDk }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{t('common.tryAgain')}</Text>
              </Pressable>
            </View>
          ) : !daily ? (
            <View style={[styles.stateCard, { backgroundColor: C.card2, borderColor: C.line, borderWidth: 1 }]}>
              <Text style={{ color: C.text2, textAlign: 'center' }}>{t('lab.noActiveDailyChallenge')}</Text>
            </View>
          ) : (
            <>
              <LinearGradient colors={[...C.dailyGradient]} style={styles.dailyCard}>
                <View style={[styles.countdownPill, { backgroundColor: C.countdownBg }]}>
                  <Ionicons name="time-outline" size={16} color={C.brown} />
                  <Text style={{ color: C.brown, fontWeight: '700', fontSize: 13 }}>
                    {t('lab.remaining', { countdown })}
                  </Text>
                </View>
                <Text style={[styles.question, { color: C.brown }]}>{daily.title}</Text>
                <Text style={[styles.dailyHint, { color: C.text2 }]}>
                  {daily.is_ai_generated ? t('lab.aiCraftedBright') : t('lab.todaysBrightPrompt')}
                </Text>
                {daily.description ? (
                  <Text style={[styles.dailyHint, { color: C.text2, marginTop: 4 }]}>{daily.description}</Text>
                ) : null}
                <TextInput
                  value={response}
                  onChangeText={setResponse}
                  placeholder={t('lab.startWriting')}
                  placeholderTextColor={C.text2}
                  multiline
                  maxLength={500}
                  style={[
                    styles.responseBox,
                    { backgroundColor: C.responseBg, borderColor: C.line, color: C.text },
                  ]}
                />
                <View style={styles.dailyFooter}>
                  <View style={styles.inlineStat}>
                    <Ionicons name="people-outline" size={16} color={C.brown} />
                    <Text style={{ color: C.brown, fontSize: 14 }}>
                      {(daily.participants || 0).toLocaleString()} {t('lab.peopleWriting')}
                    </Text>
                  </View>
                  <View style={styles.submitWrap}>
                    {submitted ? (
                      <Text style={{ color: C.successText, fontWeight: '600', fontSize: 13 }}>{t('lab.submitted')}</Text>
                    ) : null}
                    <Pressable
                      onPress={() => void submitDaily()}
                      disabled={submitting}
                      style={[styles.submitBtn, { backgroundColor: C.submitBg, opacity: submitting ? 0.65 : 1 }]}
                    >
                      <Text style={{ color: C.submitText, fontWeight: '800', fontSize: 15 }}>
                        {submitting ? t('lab.submitting') : t('lab.submitChallenge')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
              </LinearGradient>

              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {CATEGORIES.map((item) => {
                  const active = category === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setCategory(item.key)}
                      style={[
                        styles.categoryPill,
                        {
                          backgroundColor: active ? C.submitBg : C.pillBg,
                          borderColor: C.line,
                        },
                      ]}
                    >
                      <Ionicons name={item.icon} size={16} color={active ? C.submitText : C.brown} />
                      <Text style={{ color: active ? C.submitText : C.brown, fontWeight: '700', fontSize: 13 }}>
                        {t(item.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          <View style={styles.archiveHead}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>{t('lab.communityChallenges')}</Text>
            {isAuthenticated ? (
              <Pressable
                onPress={() => setShowCreate(true)}
                style={[styles.publishBtn, { backgroundColor: C.brownDk }]}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{t('lab.publishChallenge')}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.searchWrap, { backgroundColor: C.white, borderColor: C.line }]}>
            <Ionicons name="search-outline" size={18} color={C.text2} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('lab.searchChallenges')}
              placeholderTextColor={C.text2}
              style={[styles.searchInput, { color: C.text }]}
            />
          </View>

          {filteredArchive.length === 0 ? (
            <View style={[styles.stateCard, { backgroundColor: C.card2, borderColor: C.line, borderWidth: 1 }]}>
              <Text style={{ color: C.text2, textAlign: 'center' }}>{t('lab.noPastChallenges')}</Text>
            </View>
          ) : (
            <View style={styles.archiveList}>
              {filteredArchive.map((ch) => (
                <ArchiveCard
                  key={ch.id}
                  ch={ch}
                  C={C}
                  t={t}
                  isDaily={daily?.id === ch.id}
                  onOpen={() => setViewChallenge(ch)}
                />
              ))}
              {archiveHasMore && !search.trim() ? (
                <Pressable
                  onPress={() => void loadMoreArchive()}
                  disabled={archiveLoadingMore}
                  style={[styles.loadMore, { backgroundColor: C.brownDk, opacity: archiveLoadingMore ? 0.65 : 1 }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {archiveLoadingMore ? t('search.loadingMore') : t('lab.loadMoreChallenges')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}

          <View style={styles.statsRow}>
            <StatCard C={C} icon="people-outline" value={stats?.participants ?? 0} label={t('lab.participants')} />
            <StatCard C={C} icon="flame-outline" value={`${stats?.success_rate ?? 0}%`} label={t('lab.successRate')} />
            <StatCard C={C} icon="trophy-outline" value={stats?.challenges ?? 0} label={t('lab.challengesStat')} />
          </View>
        </ScrollView>
      </SafeAreaView>

      {viewChallenge ? (
        <ChallengeViewModal
          ch={viewChallenge}
          C={C}
          t={t}
          isTodayDaily={daily?.id === viewChallenge.id}
          onClose={() => setViewChallenge(null)}
          onSubmitted={onChallengeSubmitted}
        />
      ) : null}

      {showCreate ? (
        <CreateChallengeModal
          C={C}
          t={t}
          onClose={() => setShowCreate(false)}
          onCreated={(challenge) => {
            setShowCreate(false);
            setArchive((prev) => [challenge, ...prev]);
            setViewChallenge(challenge);
          }}
        />
      ) : null}
    </View>
  );
}

function ArchiveCard({
  ch,
  C,
  t,
  isDaily,
  onOpen,
}: {
  ch: Challenge;
  C: LabPalette;
  t: TFn;
  isDaily?: boolean;
  onOpen: () => void;
}) {
  return (
    <Pressable onPress={onOpen} style={[styles.archiveCard, { backgroundColor: C.white, borderColor: C.line }]}>
      {ch.cover_url ? (
        <Image source={{ uri: mediaUrl(ch.cover_url) }} style={styles.archiveImage} />
      ) : (
        <LinearGradient colors={[C.card, C.card2]} style={styles.archiveImage} />
      )}
      <View style={{ padding: 16 }}>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 17, lineHeight: 22 }}>{ch.title}</Text>
        <View style={styles.archiveMeta}>
          <Text style={{ color: C.text2, fontSize: 13 }}>{typeLabel(ch.type, t)}</Text>
          <Text style={{ color: '#7C3AED', fontWeight: '700', fontSize: 13 }}>
            {isDaily ? t('lab.today') : `${(ch.participants || 0).toLocaleString()} ${t('lab.participantsSuffix')}`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function StatCard({
  C,
  icon,
  value,
  label,
}: {
  C: LabPalette;
  icon: keyof typeof Ionicons.glyphMap;
  value: number | string;
  label: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: C.white, borderColor: C.line }]}>
      <Ionicons name={icon} size={20} color={C.brown} />
      <Text style={{ color: C.text, fontWeight: '800', fontSize: 20, marginTop: 6 }}>{value}</Text>
      <Text style={{ color: C.text2, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function ChallengeViewModal({
  ch,
  C,
  t,
  isTodayDaily,
  onClose,
  onSubmitted,
}: {
  ch: Challenge;
  C: LabPalette;
  t: TFn;
  isTodayDaily?: boolean;
  onClose: () => void;
  onSubmitted: (challengeId: number, participants: number) => void;
}) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const isOwner = Boolean(ch.is_owner || user?.is_staff || (user?.id && ch.created_by?.id === user.id));
  const [response, setResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [submissionsError, setSubmissionsError] = useState(false);
  const [moderatingId, setModeratingId] = useState<number | null>(null);

  const loadSubmissions = useCallback(async () => {
    setLoadingSubmissions(true);
    setSubmissionsError(false);
    try {
      setSubmissions(await api.getChallengeSubmissions(ch.id));
    } catch {
      setSubmissions([]);
      setSubmissionsError(true);
    } finally {
      setLoadingSubmissions(false);
    }
  }, [ch.id]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const moderate = async (submissionId: number, approve: boolean) => {
    setModeratingId(submissionId);
    try {
      await api.approveChallengeSubmission(ch.id, submissionId, approve);
      await loadSubmissions();
    } catch {
      setError(t('lab.couldNotUpdateSubmission'));
    } finally {
      setModeratingId(null);
    }
  };

  const submitEntry = async () => {
    if (!response.trim()) {
      setError(t('lab.writeSomethingFirst'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.submitChallengeEntry(ch.id, response.trim());
      setSubmitted(true);
      setResponse('');
      onSubmitted(ch.id, (ch.participants || 0) + 1);
      await loadSubmissions();
      setTimeout(() => setSubmitted(false), 3000);
    } catch (e) {
      const msg = apiErrorMessage(e);
      if (msg && /already submitted/i.test(msg)) {
        setSubmitted(true);
        await loadSubmissions();
        return;
      }
      setError(msg && msg !== 'Submit failed' ? msg : t('lab.couldNotSubmitConnection'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={[styles.modalOverlay, { backgroundColor: C.overlay }]} onPress={onClose}>
          <Pressable
            onPress={() => {}}
            style={[styles.modalSheet, { backgroundColor: C.cream, borderColor: C.line }]}
          >
            {ch.cover_url ? (
              <Image source={{ uri: mediaUrl(ch.cover_url) }} style={styles.modalCover} />
            ) : (
              <LinearGradient colors={[C.card, C.card2]} style={styles.modalCover} />
            )}
            <Pressable
              onPress={onClose}
              style={[styles.modalClose, { backgroundColor: C.card }]}
              accessibilityLabel={t('common.close')}
            >
              <Text style={{ color: C.text, fontSize: 20, lineHeight: 22 }}>×</Text>
            </Pressable>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
              <View style={[styles.chipRow, { paddingEnd: 44 }]}>
                <View style={[styles.chip, { backgroundColor: C.card2 }]}>
                  <Text style={{ color: C.brown, fontSize: 12, fontWeight: '600' }}>{typeLabel(ch.type, t)}</Text>
                </View>
                {isTodayDaily ? (
                  <View style={[styles.chip, { backgroundColor: C.brown }]}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{t('lab.todaysDaily')}</Text>
                  </View>
                ) : null}
                {ch.is_ai_generated || ch.is_daily ? (
                  <View style={[styles.chip, { backgroundColor: 'rgba(34,211,238,0.15)' }]}>
                    <Text style={{ color: '#22d3ee', fontSize: 12, fontWeight: '700' }}>{t('lab.aiBrightOnly')}</Text>
                  </View>
                ) : null}
                {ch.difficulty ? (
                  <View style={[styles.chip, { backgroundColor: C.white, borderWidth: 1, borderColor: C.line }]}>
                    <Text style={{ color: C.text2, fontSize: 12 }}>{difficultyLabel(ch.difficulty, t)}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 18, marginTop: 8 }}>{ch.title}</Text>
              <Text style={{ color: C.text2, fontSize: 12, marginTop: 4 }}>
                {t('common.by')}{' '}
                {ch.is_daily || ch.is_ai_generated
                  ? t('lab.byCosonovaAI')
                  : ch.created_by
                    ? challengeName(ch.created_by, t('lab.anonymous'))
                    : t('lab.byCommunity')}
              </Text>
              <Text style={{ color: C.text2, fontSize: 14, lineHeight: 20, marginTop: 8 }}>
                {ch.description || t('lab.noDescription')}
              </Text>
              <View style={[styles.inlineStat, { marginTop: 12 }]}>
                <Ionicons name="people-outline" size={14} color={C.text2} />
                <Text style={{ color: C.text2, fontSize: 12 }}>
                  {(ch.participants || 0).toLocaleString()} {t('lab.participantsSuffix')}
                </Text>
              </View>
              <TextInput
                value={response}
                onChangeText={setResponse}
                placeholder={t('lab.shareResponse')}
                placeholderTextColor={C.text2}
                multiline
                maxLength={1000}
                style={[
                  styles.modalInput,
                  { backgroundColor: C.white, borderColor: C.line, color: C.text },
                ]}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <View style={styles.modalSubmitRow}>
                {submitted ? (
                  <Text style={{ color: C.successText, fontWeight: '600', fontSize: 13, flex: 1 }}>
                    {ch.is_daily || ch.is_ai_generated ? t('lab.submitted') : t('lab.submittedWaitingApproval')}
                  </Text>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                <Pressable
                  onPress={() => void submitEntry()}
                  disabled={submitting}
                  style={[styles.entryBtn, { backgroundColor: C.brownDk, opacity: submitting ? 0.65 : 1 }]}
                >
                  <Ionicons name="send" size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {submitting ? t('lab.submitting') : t('lab.submitEntry')}
                  </Text>
                </Pressable>
              </View>

              <View style={[styles.subsHead, { borderTopColor: C.line }]}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>{t('lab.communitySubmissions')}</Text>
                <Text style={{ color: C.text2, fontSize: 12 }}>
                  {t('lab.shownCount', { count: String(submissions.length) })}
                </Text>
              </View>
              <Text style={{ color: C.text2, fontSize: 12, marginBottom: 12 }}>
                {isOwner && !ch.is_daily ? t('lab.ownerModerationHint') : t('lab.communityModerationHint')}{' '}
                <Text
                  onPress={() => {
                    onClose();
                    navigation.navigate('LabHistory');
                  }}
                  style={{ color: C.brownDk, fontWeight: '700', textDecorationLine: 'underline' }}
                >
                  {t('lab.labHistoryLink')}
                </Text>
              </Text>

              {loadingSubmissions ? (
                <Text style={{ color: C.text2 }}>{t('lab.loadingSubmissions')}</Text>
              ) : submissionsError ? (
                <View style={[styles.subState, { backgroundColor: C.card2 }]}>
                  <Text style={{ color: C.text2, flex: 1 }}>{t('lab.couldNotLoadSubmissions')}</Text>
                  <Pressable onPress={() => void loadSubmissions()}>
                    <Text style={{ color: C.brownDk, fontWeight: '700' }}>{t('lab.retry')}</Text>
                  </Pressable>
                </View>
              ) : submissions.length === 0 ? (
                <View style={[styles.subState, { backgroundColor: C.card2 }]}>
                  <Text style={{ color: C.text2 }}>{t('lab.noSubmissionsYet')}</Text>
                </View>
              ) : (
                submissions.map((submission) => (
                  <View
                    key={submission.id}
                    style={[styles.submissionCard, { backgroundColor: C.white, borderColor: C.line }]}
                  >
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      {submission.user.avatar ? (
                        <Image source={{ uri: mediaUrl(submission.user.avatar) }} style={styles.subAvatar} />
                      ) : (
                        <LinearGradient colors={[C.card, C.card2]} style={styles.subAvatar} />
                      )}
                      <View style={{ flex: 1 }}>
                        <View style={styles.chipRow}>
                          <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>
                            {challengeName(submission.user, t('lab.anonymous'))}
                          </Text>
                          {submission.is_approved ? (
                            <View style={[styles.miniChip, { backgroundColor: C.successBg }]}>
                              <Ionicons name="checkmark-circle" size={12} color={C.successText} />
                              <Text style={{ color: C.successText, fontSize: 11, fontWeight: '700' }}>
                                {t('lab.approved')}
                              </Text>
                            </View>
                          ) : (
                            <View style={[styles.miniChip, { backgroundColor: 'rgba(251, 191, 36, 0.18)' }]}>
                              <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '700' }}>
                                {t('lab.pendingReview')}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ color: C.text2, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                          {submission.content}
                        </Text>
                        <View style={[styles.chipRow, { marginTop: 8 }]}>
                          <Text style={{ color: C.text2, fontSize: 11 }}>
                            {formatDate(submission.submitted_at || submission.created_at, t('lab.justNow'))}
                          </Text>
                          {isOwner && !ch.is_daily ? (
                            !submission.is_approved ? (
                              <Pressable
                                disabled={moderatingId === submission.id}
                                onPress={() => void moderate(submission.id, true)}
                                style={[styles.modBtn, { backgroundColor: C.brown }]}
                              >
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{t('lab.approve')}</Text>
                              </Pressable>
                            ) : (
                              <Pressable
                                disabled={moderatingId === submission.id}
                                onPress={() => void moderate(submission.id, false)}
                                style={[styles.modBtn, { backgroundColor: C.card2 }]}
                              >
                                <Text style={{ color: C.text2, fontSize: 11, fontWeight: '700' }}>{t('lab.hide')}</Text>
                              </Pressable>
                            )
                          ) : null}
                        </View>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CreateChallengeModal({
  C,
  t,
  onClose,
  onCreated,
}: {
  C: LabPalette;
  t: TFn;
  onClose: () => void;
  onCreated: (challenge: Challenge) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('writing');
  const [difficulty, setDifficulty] = useState('easy');
  const [cover, setCover] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pickCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if ((asset.fileSize || 0) > 5 * 1024 * 1024) {
      setError(t('lab.imageTooLarge'));
      return;
    }
    setError('');
    setCover(asset);
  };

  const submit = async () => {
    if (!title.trim()) {
      setError(t('lab.addTitlePrompt'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const end = new Date();
      end.setDate(end.getDate() + 14);
      const form = new FormData();
      form.append('title', title.trim());
      form.append('description', description.trim());
      form.append('type', type);
      form.append('difficulty', difficulty);
      form.append('end_date', end.toISOString());
      if (cover?.uri) {
        form.append('cover_image', {
          uri: cover.uri,
          name: cover.fileName || 'cover.jpg',
          type: cover.mimeType || 'image/jpeg',
        } as unknown as Blob);
      }
      const created = await api.createChallenge(form);
      onCreated(created as Challenge);
    } catch (e) {
      const msg = apiErrorMessage(e);
      setError(msg || t('lab.couldNotPublish'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={[styles.modalOverlay, { backgroundColor: C.overlay }]} onPress={onClose}>
          <Pressable
            onPress={() => {}}
            style={[styles.createSheet, { backgroundColor: C.cream, borderColor: C.line }]}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 18 }}>{t('lab.publishCommunityChallenge')}</Text>
              <Text style={{ color: C.text2, fontSize: 13, marginTop: 4, marginBottom: 16 }}>
                {t('lab.moderateEntriesHint')}
              </Text>
              <Text style={[styles.fieldLabel, { color: C.text2 }]}>{t('lab.titleLabel')}</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                maxLength={120}
                placeholder={t('lab.titlePlaceholder')}
                placeholderTextColor={C.text2}
                style={[styles.fieldInput, { backgroundColor: C.white, borderColor: C.line, color: C.text }]}
              />
              <Text style={[styles.fieldLabel, { color: C.text2 }]}>{t('lab.descriptionLabel')}</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                maxLength={500}
                multiline
                placeholder={t('lab.descriptionPlaceholder')}
                placeholderTextColor={C.text2}
                style={[
                  styles.fieldInput,
                  styles.fieldArea,
                  { backgroundColor: C.white, borderColor: C.line, color: C.text },
                ]}
              />
              <Text style={[styles.fieldLabel, { color: C.text2 }]}>
                {t('lab.coverImageLabel')} {t('lab.optional')}
              </Text>
              {cover?.uri ? (
                <View style={styles.coverPreviewWrap}>
                  <Image source={{ uri: cover.uri }} style={styles.coverPreview} />
                  <Pressable onPress={() => setCover(null)} style={styles.removeCover}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{t('lab.removeImage')}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => void pickCover()}
                  style={[styles.coverPicker, { borderColor: C.line, backgroundColor: C.white }]}
                >
                  <Text style={{ color: C.brown, fontWeight: '700' }}>{t('lab.uploadImage')}</Text>
                  <Text style={{ color: C.text2, fontSize: 12, marginTop: 4 }}>{t('lab.imageFormatHint')}</Text>
                </Pressable>
              )}
              <Text style={[styles.fieldLabel, { color: C.text2 }]}>{t('lab.typeLabel')}</Text>
              <View style={styles.optionRow}>
                {CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                  <Pressable
                    key={c.key}
                    onPress={() => setType(c.key)}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor: type === c.key ? C.brownDk : C.white,
                        borderColor: C.line,
                      },
                    ]}
                  >
                    <Text style={{ color: type === c.key ? '#fff' : C.text2, fontWeight: '700', fontSize: 12 }}>
                      {t(c.labelKey)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.fieldLabel, { color: C.text2 }]}>{t('lab.difficultyLabel')}</Text>
              <View style={styles.optionRow}>
                {(['easy', 'medium', 'hard'] as const).map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => setDifficulty(d)}
                    style={[
                      styles.optionChip,
                      {
                        backgroundColor: difficulty === d ? C.brownDk : C.white,
                        borderColor: C.line,
                      },
                    ]}
                  >
                    <Text style={{ color: difficulty === d ? '#fff' : C.text2, fontWeight: '700', fontSize: 12 }}>
                      {difficultyLabel(d, t)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <View style={styles.createActions}>
                <Pressable onPress={onClose} style={[styles.cancelBtn, { backgroundColor: C.card2 }]}>
                  <Text style={{ color: C.text2, fontWeight: '700' }}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void submit()}
                  disabled={busy}
                  style={[styles.publishBtnLg, { backgroundColor: C.brownDk, opacity: busy ? 0.65 : 1 }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '800' }}>
                    {busy ? t('lab.publishing') : t('lab.publish')}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: { gap: 12 },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    minHeight: 36,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: { fontSize: 32, fontWeight: '800', lineHeight: 36 },
  subtitle: { marginTop: 6, fontSize: 16 },
  topActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  ritualBtn: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  ritualBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  historyLink: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  relayCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  relayTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  relayHint: { fontSize: 12, marginBottom: 10 },
  relayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  relayAvatar: { width: 32, height: 32, borderRadius: 16 },
  relayAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  linkError: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stateCard: { borderRadius: 28, padding: 36, alignItems: 'center' },
  retryBtn: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  dailyCard: { borderRadius: 26, padding: 20 },
  countdownPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  question: { marginTop: 18, fontSize: 24, fontWeight: '800', lineHeight: 30 },
  dailyHint: { marginTop: 8, fontSize: 13, opacity: 0.9, lineHeight: 18 },
  responseBox: {
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 128,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  dailyFooter: { marginTop: 14, gap: 12 },
  inlineStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  submitWrap: { gap: 10 },
  submitBtn: {
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  errorText: { color: '#c0392b', fontSize: 13, marginTop: 8 },
  categoryRow: { gap: 10, paddingVertical: 2 },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  archiveHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  sectionTitle: { fontSize: 24, fontWeight: '800' },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 10 },
  archiveList: { gap: 14 },
  archiveCard: { borderRadius: 22, overflow: 'hidden', borderWidth: 1 },
  archiveImage: { height: 176, width: '100%' },
  archiveMeta: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  loadMore: {
    alignSelf: 'center',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 16 },
  modalSheet: {
    maxHeight: '90%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  modalCover: { height: 128, width: '100%' },
  modalClose: {
    position: 'absolute',
    top: 140,
    right: 12,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  modalInput: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 80,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  modalSubmitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  entryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 44,
  },
  subsHead: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subState: { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  submissionCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10 },
  subAvatar: { width: 40, height: 40, borderRadius: 20 },
  modBtn: { marginLeft: 'auto', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  createSheet: {
    maxHeight: '90%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  fieldInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  fieldArea: { minHeight: 80, textAlignVertical: 'top' },
  coverPicker: {
    height: 112,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  coverPreviewWrap: { height: 144, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  coverPreview: { width: '100%', height: '100%' },
  removeCover: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  optionChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  cancelBtn: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  publishBtnLg: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
});
