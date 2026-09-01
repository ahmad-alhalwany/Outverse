import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useLocale } from '@/i18n/LocaleProvider';
import { useTheme } from '@/hooks/useTheme';
import { displayName as personName } from '@/lib/names';
import { goTab, openProfile } from '@/lib/nav';
import { emotionMeta, formatCount, happyDaysPercent } from '@/lib/profileEmotions';
import { formatBottleTimeLeft } from '@/lib/bottleTime';
import StoryViewer from '@/components/StoryViewer';
import type { Post, Reel, User } from '@/types';
import {
  EmptyTab,
  FollowListModal,
  IdeasGrid,
  ReelsGrid,
  SocialSheet,
  SubscribeSheet,
  TipSheet,
  type CreatorTier,
  type IdeaRow,
  type SocialStatus,
} from './profileParts';

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
    tabBg: '#EDE4DC',
    identity: 'rgba(255,255,255,0.92)',
    coverFade: ['rgba(255,255,255,0.04)', 'rgba(243,240,252,0.18)'] as const,
    coverFallback: ['#C4B5FD', '#A78BFA', '#7DD3FC'] as const,
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
    tabBg: '#1e1738',
    identity: 'rgba(30,23,64,0.86)',
    coverFade: ['rgba(15,12,31,0.04)', 'rgba(20,16,42,0.44)'] as const,
    coverFallback: ['#251B4D', '#1E1740', '#14102A'] as const,
  },
};

const WEEK_KEYS = [
  'profile.weekMon',
  'profile.weekTue',
  'profile.weekWed',
  'profile.weekThu',
  'profile.weekFri',
  'profile.weekSat',
  'profile.weekSun',
];

const SPENDER: Record<'bronze' | 'silver' | 'gold', { emoji: string; labelKey: string; color: string }> = {
  bronze: { emoji: '🥉', labelKey: 'profile.tierBronze', color: '#B08D57' },
  silver: { emoji: '🥈', labelKey: 'profile.tierSilver', color: '#9CA3AF' },
  gold: { emoji: '🥇', labelKey: 'profile.tierGold', color: '#D4AF37' },
};

type TabKey = 'posts' | 'reels' | 'ideas' | 'challenges' | 'stories' | 'bottles';
type Profile = User & {
  reels_count?: number;
  points?: number;
  karma?: number;
  badge_verified?: boolean;
  spender_tier?: 'none' | 'bronze' | 'silver' | 'gold';
  social?: SocialStatus;
  achievements?: Array<string | { id?: number | string; icon?: string; title?: string; completed?: boolean }>;
};
type ChallengeRow = {
  id: string | number;
  content?: string;
  is_approved?: boolean;
  challenge?: { id?: string | number; title?: string };
};
type BottleRow = { id: string | number; message?: string; emotion_type?: string; expires_at?: string };
type ForgeStory = {
  id: number;
  title: string;
  cover_url?: string;
  segment_count?: number;
  max_segments?: number;
  genre?: string;
};
type ExperienceItem = {
  id: number;
  title: string;
  organization?: string;
  start_date?: string;
  end_date?: string | null;
  is_current?: boolean;
  description?: string;
};
type ConstellationRow = { id: number; title: string; cover?: string | null };
type TimelineDay = { day: number; date: string; emotion: string | null };

const EMPTY_EXP = {
  title: '',
  organization: '',
  start_date: '',
  end_date: '',
  is_current: false,
  description: '',
};

function initials(name: string) {
  return name ? name.slice(0, 2).toUpperCase() : '??';
}

function postThumb(post: Post): string {
  const m = post.media?.[0];
  if (!m) return '';
  return mediaUrl(m.thumbnail_url || m.thumbnail || m.media_file || m.url || m.file) || '';
}

function postTitle(text: string, fallback: string) {
  const line = (text || '').trim().split('\n')[0];
  if (!line) return fallback;
  return line.length > 48 ? `${line.slice(0, 48)}…` : line;
}

function reactionTotal(counts?: Record<string, number>) {
  if (!counts) return 0;
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

function listFrom(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)) {
    return (data as { results: unknown[] }).results;
  }
  return [];
}

export default function ProfileScreen({
  route,
  navigation,
}: {
  route: { name?: string; params?: { username?: string } };
  navigation: any;
}) {
  const { user, isAuthenticated } = useAuth();
  const { isDark } = useTheme();
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const C = isDark ? PALETTES.dark : PALETTES.light;
  const targetUsername = route.params?.username;
  const isOwnProfile = !targetUsername || (user && targetUsername === user.username);
  const showBack = route.name === 'UserProfile';

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [savedReels, setSavedReels] = useState<Reel[]>([]);
  const [ideas, setIdeas] = useState<IdeaRow[]>([]);
  const [ideaScope, setIdeaScope] = useState<'owned' | 'collaborating' | 'supporting'>('owned');
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [bottles, setBottles] = useState<BottleRow[]>([]);
  const [stories, setStories] = useState<ForgeStory[]>([]);
  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [experienceForm, setExperienceForm] = useState(EMPTY_EXP);
  const [editingExperienceId, setEditingExperienceId] = useState<number | null>(null);
  const [experienceBusy, setExperienceBusy] = useState(false);
  const [experienceError, setExperienceError] = useState('');
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [currentMood, setCurrentMood] = useState<string | null>(null);
  const [moodInsights, setMoodInsights] = useState<{ emotion: string; pct: number }[]>([]);
  const [futureMemory, setFutureMemory] = useState<{ text: string; tag?: string } | null>(null);
  const [constellations, setConstellations] = useState<ConstellationRow[]>([]);
  const [constellationDraft, setConstellationDraft] = useState('');
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyPlaylist, setStoryPlaylist] = useState<any[]>([]);
  const [tiers, setTiers] = useState<CreatorTier[]>([]);
  const [tab, setTab] = useState<TabKey>('posts');
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [followError, setFollowError] = useState('');
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setProfileError(false);
    setBlocked(false);
    try {
      let loaded: Profile | null = null;
      if (isOwnProfile && user?.id) {
        try {
          loaded = { ...user, ...(await api.getProfileById(user.id)) };
        } catch {
          loaded = user as Profile;
        }
      } else if (targetUsername) {
        loaded = await api.getProfile(targetUsername);
      }
      if (!loaded?.id) {
        setProfile(null);
        return;
      }
      setProfile(loaded);
      const userId = loaded.id;
      const own = !targetUsername || (user && targetUsername === user.username);
      const [
        postsRes,
        moodRes,
        storiesRes,
        challRes,
        bottlesRes,
        suggestionsRes,
        experienceRes,
        memoryRes,
        reelsRes,
        ideaRes,
        constellationRes,
        tiersRes,
        savedRes,
      ] = await Promise.all([
        api.getPosts({ offset: 0, limit: 60, author: userId }).catch(() => ({ results: [] })),
        own ? api.getBottlesDashboard().catch(() => null) : Promise.resolve(null),
        api.getForgeStories({ owner: userId }).catch(() => []),
        api.getUserChallengeEntries(userId).catch(() => []),
        own ? api.getMyBottles(true).catch(() => []) : Promise.resolve([]),
        api.getSuggestions(userId).catch(() => []),
        api.getUserExperience(userId).catch(() => []),
        api.getFutureMemories(userId).catch(() => []),
        api.getReels({ limit: 40, offset: 0, user: userId }).catch(() => ({ results: [] })),
        api
          .getIdeas(own ? { ordering: 'new', owner: 'me', limit: 30 } : { ordering: 'new', owner_id: userId, limit: 30 })
          .catch(() => ({ results: [] })),
        api.getConstellations(userId).catch(() => []),
        own ? Promise.resolve([]) : api.getCreatorTiers(userId).catch(() => []),
        own ? api.getSavedReels({ limit: 40 }).catch(() => ({ results: [] })) : Promise.resolve({ results: [] }),
      ]);
      setPosts(postsRes.results || []);
      setTimeline(Array.isArray(moodRes?.timeline) ? moodRes.timeline : []);
      setCurrentMood(moodRes?.current_mood ?? null);
      setMoodInsights(Array.isArray(moodRes?.insights) ? moodRes.insights : []);
      setStories(listFrom(storiesRes) as ForgeStory[]);
      setChallenges(Array.isArray(challRes) ? (challRes as ChallengeRow[]) : []);
      setBottles(Array.isArray(bottlesRes) ? (bottlesRes as BottleRow[]) : []);
      setSuggestions(Array.isArray(suggestionsRes) ? (suggestionsRes as Profile[]) : []);
      setExperiences(Array.isArray(experienceRes) ? (experienceRes as ExperienceItem[]) : []);
      setFutureMemory(listFrom(memoryRes)[0] || null);
      setReels(reelsRes.results || []);
      setIdeas((ideaRes.results || []) as IdeaRow[]);
      setConstellations(Array.isArray(constellationRes) ? (constellationRes as ConstellationRow[]) : []);
      setTiers((tiersRes as CreatorTier[]).filter((tier) => (tier as { is_active?: boolean }).is_active !== false));
      setSavedReels(savedRes.results || []);
    } catch {
      setProfileError(true);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [isOwnProfile, targetUsername, user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const loadIdeas = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const page = await api.getIdeas(
        isOwnProfile
          ? { ordering: 'new', owner: ideaScope === 'owned' ? 'me' : ideaScope, limit: 30 }
          : { ordering: 'new', owner_id: profile.id, limit: 30 },
      );
      setIdeas((page.results || []) as IdeaRow[]);
    } catch {
      setIdeas([]);
    }
  }, [ideaScope, isOwnProfile, profile?.id]);

  useEffect(() => {
    if (tab === 'ideas') void loadIdeas();
  }, [loadIdeas, tab]);

  const weeklyMood = useMemo(() => timeline.slice(-7), [timeline]);
  const happyPct = useMemo(() => happyDaysPercent(timeline), [timeline]);
  const mappedPosts = useMemo(
    () => [...posts].sort((a, b) => Number(!!b.is_profile_pinned) - Number(!!a.is_profile_pinned)),
    [posts],
  );

  const toggleFollow = async () => {
    if (!profile || !isAuthenticated) return;
    setFollowError('');
    try {
      const result = await api.toggleFollow(profile.id);
      if (result.error) {
        setFollowError(result.error);
        return;
      }
      const next = result.is_following ?? result.following ?? !profile.is_following;
      setProfile({
        ...profile,
        is_following: !!next,
        followers_count:
          typeof result.followers_count === 'number'
            ? result.followers_count
            : profile.followers_count + (next ? 1 : -1),
      });
    } catch {
      setFollowError(t('profile.followError'));
    }
  };

  const saveExperience = async () => {
    if (!experienceForm.title.trim() || !experienceForm.organization.trim() || !experienceForm.start_date || experienceBusy) {
      return;
    }
    setExperienceBusy(true);
    setExperienceError('');
    const payload = {
      title: experienceForm.title.trim(),
      organization: experienceForm.organization.trim(),
      start_date: experienceForm.start_date,
      end_date: experienceForm.is_current ? null : experienceForm.end_date || null,
      is_current: experienceForm.is_current,
      description: experienceForm.description.trim(),
    };
    try {
      const saved = editingExperienceId
        ? await api.updateExperience(editingExperienceId, payload)
        : await api.createExperience(payload);
      setExperiences((prev) =>
        editingExperienceId ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev],
      );
      setExperienceForm(EMPTY_EXP);
      setEditingExperienceId(null);
    } catch {
      setExperienceError(t('profile.saveExperienceError'));
    } finally {
      setExperienceBusy(false);
    }
  };

  const deleteExperience = async (id: number) => {
    if (experienceBusy) return;
    setExperienceBusy(true);
    try {
      await api.deleteExperience(id);
      setExperiences((prev) => prev.filter((item) => item.id !== id));
      if (editingExperienceId === id) {
        setExperienceForm(EMPTY_EXP);
        setEditingExperienceId(null);
      }
    } catch {
      setExperienceError(t('profile.deleteExperienceError'));
    } finally {
      setExperienceBusy(false);
    }
  };

  const openConstellation = async (id: number) => {
    try {
      const data = await api.getConstellation(id);
      const items = (data.stories || []).map((s: any) => ({
        ...s,
        media: s.image || s.video,
        media_type: s.video ? 'video' : 'image',
      }));
      if (!items.length) return;
      setStoryPlaylist(items);
      setStoryViewerOpen(true);
    } catch {
      /* ignore */
    }
  };

  if (loading && !profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.cream }} edges={showBack ? ['bottom'] : ['top']}>
        <View style={{ padding: 16 }}>
          <View style={{ height: 144, borderRadius: 16, backgroundColor: C.card }} />
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.card2, marginTop: -48, marginLeft: 8 }} />
        </View>
        <Text style={{ textAlign: 'center', color: C.text2, marginTop: 24 }}>{t('profile.loading')}</Text>
      </SafeAreaView>
    );
  }

  if (blocked) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: C.cream }]}>
        <Text style={{ color: C.text2, textAlign: 'center', paddingHorizontal: 24 }}>{t('profile.blockedConfirm')}</Text>
        <Pressable onPress={() => goTab(navigation, 'Home')} style={[styles.roundBtn, { backgroundColor: C.card, marginTop: 16 }]}>
          <Text style={{ color: C.brown, fontWeight: '700' }}>{t('profile.backToHome')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!profile && profileError) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: C.cream }]}>
        <Text style={{ color: C.text2, textAlign: 'center' }}>{t('profile.loadError')}</Text>
        <Pressable onPress={() => void load()} style={[styles.roundBtn, { backgroundColor: C.card, marginTop: 16 }]}>
          <Text style={{ color: C.brown, fontWeight: '700' }}>{t('profile.retry')}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: C.cream }]}>
        <Text style={{ color: C.text2 }}>{t('profile.notFound')}</Text>
      </SafeAreaView>
    );
  }

  const name = personName(profile, profile.username);
  const avatarSrc = profile.avatar ? mediaUrl(profile.avatar) : '';
  const coverSrc = mediaUrl(profile.cover_photo || profile.cover_image);
  const moodMeta = currentMood ? emotionMeta(currentMood) : null;
  const verified = !!(profile.badge_verified || profile.is_verified);
  const earnedAchievements = (profile.achievements ?? []).filter((a) => (typeof a === 'string' ? true : a.completed === true));
  const coverColors = moodMeta ? ([moodMeta.color, C.cream] as const) : C.coverFallback;
  const padBottom = insets.bottom + (showBack ? 28 : 100);

  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <SafeAreaView style={{ flex: 1 }} edges={showBack ? [] : ['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingBottom: padBottom }}
        >
          <View style={styles.cover}>
            {coverSrc ? (
              <Image source={{ uri: coverSrc }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <LinearGradient colors={[...coverColors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient colors={[...C.coverFade]} style={StyleSheet.absoluteFill} pointerEvents="none" />
            {showBack ? (
              <Pressable onPress={() => navigation.goBack()} style={[styles.coverBack, { top: insets.top + 6 }]}>
                <Ionicons name="chevron-back" size={22} color="#F5F3FF" />
              </Pressable>
            ) : null}
            {isOwnProfile ? (
              <View style={[styles.coverActions, { top: showBack ? insets.top + 6 : 12 }]}>
                <Pressable onPress={() => navigation.navigate('Analytics')} style={[styles.coverChip, { backgroundColor: C.white, borderColor: C.line }]}>
                  <Ionicons name="bar-chart-outline" size={14} color={C.text} />
                  <Text style={[styles.chipText, { color: C.text }]}>{t('profile.viewAnalytics')}</Text>
                </Pressable>
                <Pressable onPress={() => navigation.navigate('CreatorStudio')} style={[styles.coverChip, { backgroundColor: C.white, borderColor: C.line }]}>
                  <Ionicons name="sparkles-outline" size={14} color={C.text} />
                  <Text style={[styles.chipText, { color: C.text }]}>{t('profile.creatorHub')}</Text>
                </Pressable>
                <Pressable onPress={() => navigation.navigate('EditProfile')} style={[styles.coverChip, { backgroundColor: C.white, borderColor: C.line }]}>
                  <Ionicons name="pencil-outline" size={14} color={C.text} />
                  <Text style={[styles.chipText, { color: C.text }]}>{t('profile.editProfile')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={{ marginTop: -56, paddingHorizontal: 16 }}>
            <View style={[styles.identity, { backgroundColor: C.identity, borderColor: C.line }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
                {avatarSrc ? (
                  <Image source={{ uri: avatarSrc }} style={[styles.avatar, { borderColor: C.cream }]} />
                ) : (
                  <LinearGradient colors={[C.brown, C.brownDk]} style={[styles.avatar, styles.avatarFallback, { borderColor: C.cream }]}>
                    <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>{initials(name)}</Text>
                  </LinearGradient>
                )}
                <View style={{ flex: 1, paddingBottom: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={{ color: C.text, fontSize: 22, fontWeight: '800' }}>{name}</Text>
                    {verified ? <Ionicons name="checkmark-circle" size={20} color="#9C27B0" /> : null}
                  </View>
                  <Text style={{ color: C.text2, fontSize: 14 }}>@{profile.username}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {moodMeta ? (
                      <View style={[styles.pill, { backgroundColor: `${moodMeta.color}22` }]}>
                        <Text style={{ color: moodMeta.color, fontSize: 11, fontWeight: '700' }}>
                          {moodMeta.emoji} {t('profile.feeling')} {t(moodMeta.labelKey)}
                        </Text>
                      </View>
                    ) : null}
                    {profile.spender_tier && profile.spender_tier !== 'none' ? (
                      <View style={[styles.pill, { backgroundColor: `${SPENDER[profile.spender_tier].color}22` }]}>
                        <Text style={{ color: SPENDER[profile.spender_tier].color, fontSize: 11, fontWeight: '700' }}>
                          {SPENDER[profile.spender_tier].emoji} {t(SPENDER[profile.spender_tier].labelKey)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              {!isOwnProfile && !profile.social?.is_blocked ? (
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => void toggleFollow()}
                    style={[
                      styles.followBtn,
                      {
                        backgroundColor: profile.is_following ? C.card2 : C.brownDk,
                        borderColor: C.line,
                        borderWidth: profile.is_following ? 1 : 0,
                      },
                    ]}
                  >
                    <Text style={{ color: profile.is_following ? C.text : '#fff', fontWeight: '700' }}>
                      {profile.is_following ? t('profile.following') : t('profile.follow')}
                    </Text>
                  </Pressable>
                  {!profile.social?.blocked_by_them ? (
                    <>
                      <Pressable onPress={() => setTipOpen(true)} style={[styles.ghostBtn, { backgroundColor: C.card2, borderColor: C.line }]}>
                        <Ionicons name="gift-outline" size={16} color={C.text} />
                        <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{t('tip.send')}</Text>
                      </Pressable>
                      {tiers.length > 0 ? (
                        <Pressable onPress={() => setSubOpen(true)} style={[styles.ghostBtn, { backgroundColor: C.card2, borderColor: C.line }]}>
                          <Ionicons name="star-outline" size={16} color={C.text} />
                          <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{t('profile.subscribe')}</Text>
                        </Pressable>
                      ) : null}
                    </>
                  ) : null}
                  <Pressable onPress={() => setSocialOpen(true)} style={[styles.ghostBtn, { backgroundColor: C.card2, borderColor: C.line, paddingHorizontal: 12 }]}>
                    <Text style={{ color: C.text, fontWeight: '800' }}>···</Text>
                  </Pressable>
                </View>
              ) : null}
              {followError ? <Text style={styles.error}>{followError}</Text> : null}

              {profile.bio ? <Text style={{ color: C.text, fontSize: 14, lineHeight: 20, marginTop: 16 }}>{profile.bio}</Text> : null}
              {(profile.location || '').trim() ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                  <Ionicons name="location-outline" size={14} color={C.text2} />
                  <Text style={{ color: C.text2, fontSize: 12 }}>{profile.location}</Text>
                </View>
              ) : null}

              {moodInsights.length > 0 ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.kicker, { color: C.text2 }]}>{t('profile.emotionalFingerprint')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {moodInsights.map((insight) => {
                      const m = emotionMeta(insight.emotion);
                      return (
                        <View key={insight.emotion} style={[styles.pill, { backgroundColor: `${m.color}18`, borderWidth: 1, borderColor: `${m.color}33` }]}>
                          <Text style={{ color: m.color, fontSize: 12, fontWeight: '600' }}>
                            {m.emoji} {t(m.labelKey)} · {insight.pct}%
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View style={styles.statRow}>
                <View style={[styles.statPill, { backgroundColor: C.card2, borderColor: C.line }]}>
                  <Text style={{ color: C.text, fontWeight: '800' }}>{formatCount(profile.posts_count || posts.length)}</Text>
                  <Text style={{ color: C.text2 }}> {t('profile.statPosts')}</Text>
                </View>
                <Pressable onPress={() => setTab('reels')} style={[styles.statPill, { backgroundColor: C.card2, borderColor: C.line }]}>
                  <Text style={{ color: C.text, fontWeight: '800' }}>{formatCount(profile.reels_count ?? reels.length)}</Text>
                  <Text style={{ color: C.text2 }}> {t('profile.statSignals')}</Text>
                </Pressable>
                <Pressable onPress={() => setFollowModal('followers')} style={[styles.statPill, { backgroundColor: C.card2, borderColor: C.line }]}>
                  <Text style={{ color: C.text, fontWeight: '800' }}>{formatCount(profile.followers_count || 0)}</Text>
                  <Text style={{ color: C.text2 }}> {t('profile.statFollowers')}</Text>
                </Pressable>
                <Pressable onPress={() => setFollowModal('following')} style={[styles.statPill, { backgroundColor: C.card2, borderColor: C.line }]}>
                  <Text style={{ color: C.text, fontWeight: '800' }}>{formatCount(profile.following_count || 0)}</Text>
                  <Text style={{ color: C.text2 }}> {t('profile.statFollowing')}</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={[styles.panel, { backgroundColor: C.card2, borderColor: C.line }]}>
            <Text style={{ color: C.text, fontWeight: '800', marginBottom: 12 }}>{t('profile.weeklyMoodTitle')}</Text>
            <View style={styles.weekRow}>
              {weeklyMood.map((day, i) => {
                const m = day.emotion ? emotionMeta(day.emotion) : null;
                return (
                  <View key={`${day.date}-${i}`} style={{ alignItems: 'center', flex: 1, gap: 4 }}>
                    <Text style={{ color: C.text2, fontSize: 10, fontWeight: '600' }}>{WEEK_KEYS[i] ? t(WEEK_KEYS[i]) : `D${day.day}`}</Text>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: m ? `${m.color}22` : C.white,
                        borderWidth: 1,
                        borderColor: m ? `${m.color}55` : C.line,
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>{m ? m.emoji : '·'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={[styles.happyBox, { backgroundColor: C.white, borderColor: C.line }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: C.text, fontSize: 13 }}>
                  <Text style={{ fontWeight: '800' }}>{happyPct}%</Text> {t('profile.happyDaysThisMonth')}
                </Text>
                <Text>✨</Text>
              </View>
              <View style={{ height: 8, borderRadius: 999, overflow: 'hidden', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                <View style={{ width: `${happyPct}%`, height: '100%', backgroundColor: C.brownDk }} />
              </View>
            </View>
          </View>

          {futureMemory ? (
            <View style={[styles.panel, { backgroundColor: C.card, borderColor: C.line }]}>
              <Text style={{ color: C.text, fontWeight: '800', marginBottom: 8 }}>🔮 {t('profile.futureMemoryTitle')}</Text>
              <Text style={{ color: C.text, fontSize: 14, fontStyle: 'italic', lineHeight: 20 }}>"{futureMemory.text}"</Text>
              {futureMemory.tag ? (
                <View style={[styles.pill, { backgroundColor: C.white, marginTop: 8, alignSelf: 'flex-start' }]}>
                  <Text style={{ color: C.text2, fontSize: 12 }}>#{futureMemory.tag}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {isOwnProfile || experiences.length > 0 ? (
            <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="briefcase-outline" size={18} color={C.brown} />
                    <Text style={{ color: C.text, fontWeight: '800' }}>{t('profile.experienceTitle')}</Text>
                  </View>
                  <Text style={{ color: C.text2, fontSize: 12, marginTop: 4 }}>
                    {isOwnProfile ? t('profile.experienceSubtitleOwn') : t('profile.experienceSubtitleOther', { name })}
                  </Text>
                </View>
                {isOwnProfile && editingExperienceId ? (
                  <Pressable onPress={() => { setExperienceForm(EMPTY_EXP); setEditingExperienceId(null); }}>
                    <Text style={{ color: C.brown, fontWeight: '700', fontSize: 12 }}>{t('profile.cancelEdit')}</Text>
                  </Pressable>
                ) : null}
              </View>
              {isOwnProfile ? (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <TextInput value={experienceForm.title} onChangeText={(title) => setExperienceForm((f) => ({ ...f, title }))} placeholder={t('profile.experienceFieldTitle')} placeholderTextColor={C.text2} style={[styles.field, { backgroundColor: C.card2, borderColor: C.line, color: C.text }]} />
                  <TextInput value={experienceForm.organization} onChangeText={(organization) => setExperienceForm((f) => ({ ...f, organization }))} placeholder={t('profile.experienceFieldOrganization')} placeholderTextColor={C.text2} style={[styles.field, { backgroundColor: C.card2, borderColor: C.line, color: C.text }]} />
                  <Text style={{ color: C.text2, fontSize: 12, fontWeight: '700' }}>{t('profile.experienceFieldStartDate')}</Text>
                  <TextInput value={experienceForm.start_date} onChangeText={(start_date) => setExperienceForm((f) => ({ ...f, start_date }))} placeholder="YYYY-MM-DD" placeholderTextColor={C.text2} style={[styles.field, { backgroundColor: C.card2, borderColor: C.line, color: C.text }]} />
                  <Text style={{ color: C.text2, fontSize: 12, fontWeight: '700' }}>{t('profile.experienceFieldEndDate')}</Text>
                  <TextInput value={experienceForm.end_date} editable={!experienceForm.is_current} onChangeText={(end_date) => setExperienceForm((f) => ({ ...f, end_date }))} placeholder="YYYY-MM-DD" placeholderTextColor={C.text2} style={[styles.field, { backgroundColor: C.card2, borderColor: C.line, color: C.text, opacity: experienceForm.is_current ? 0.5 : 1 }]} />
                  <TextInput value={experienceForm.description} onChangeText={(description) => setExperienceForm((f) => ({ ...f, description }))} placeholder={t('profile.experienceFieldDescription')} placeholderTextColor={C.text2} multiline style={[styles.field, { backgroundColor: C.card2, borderColor: C.line, color: C.text, minHeight: 64, textAlignVertical: 'top' }]} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Pressable onPress={() => setExperienceForm((f) => ({ ...f, is_current: !f.is_current, end_date: !f.is_current ? '' : f.end_date }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Ionicons name={experienceForm.is_current ? 'checkbox' : 'square-outline'} size={18} color={C.brown} />
                      <Text style={{ color: C.text2, fontSize: 13 }}>{t('profile.experienceCurrentCheckbox')}</Text>
                    </Pressable>
                    <Pressable onPress={() => void saveExperience()} disabled={experienceBusy} style={[styles.followBtn, { backgroundColor: C.brownDk, opacity: experienceBusy ? 0.6 : 1 }]}>
                      <Ionicons name="add" size={14} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{editingExperienceId ? t('profile.experienceSaveChanges') : t('profile.experienceAdd')}</Text>
                    </Pressable>
                  </View>
                  {experienceError ? <Text style={styles.error}>{experienceError}</Text> : null}
                </View>
              ) : null}
              <View style={{ marginTop: 16, gap: 10 }}>
                {experiences.length === 0 ? (
                  <Text style={{ color: C.text2, fontSize: 13 }}>{t('profile.experienceEmpty')}</Text>
                ) : (
                  experiences.map((item) => (
                    <View key={item.id} style={[styles.expCard, { backgroundColor: C.card2, borderColor: C.line }]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: C.text, fontWeight: '700' }}>{item.title}</Text>
                          <Text style={{ color: C.text2, fontSize: 13 }}>{item.organization}</Text>
                          <Text style={{ color: C.text2, fontSize: 11, marginTop: 4 }}>
                            {item.start_date} - {item.is_current ? t('profile.experiencePresent') : item.end_date || t('profile.experiencePresent')}
                          </Text>
                        </View>
                        {isOwnProfile ? (
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <Pressable
                              onPress={() => {
                                setExperienceForm({
                                  title: item.title || '',
                                  organization: item.organization || '',
                                  start_date: item.start_date || '',
                                  end_date: item.end_date || '',
                                  is_current: !!item.is_current,
                                  description: item.description || '',
                                });
                                setEditingExperienceId(item.id);
                              }}
                              style={[styles.iconBtn, { backgroundColor: C.white }]}
                            >
                              <Ionicons name="pencil-outline" size={14} color={C.brown} />
                            </Pressable>
                            <Pressable onPress={() => void deleteExperience(item.id)} style={[styles.iconBtn, { backgroundColor: C.white }]}>
                              <Ionicons name="trash-outline" size={14} color="#EF4444" />
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                      {item.description ? <Text style={{ color: C.text, fontSize: 13, marginTop: 8 }}>{item.description}</Text> : null}
                    </View>
                  ))
                )}
              </View>
            </View>
          ) : null}

          <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Ionicons name="sparkles-outline" size={18} color={C.brown} />
              <Text style={{ color: C.text, fontWeight: '800' }}>{t('profile.achievementsTitle')}</Text>
            </View>
            <View style={[styles.balanceRow, { backgroundColor: C.card2 }]}>
              <Text style={{ color: C.text2 }}>{t('profile.pointsBalance')}</Text>
              <Text style={{ color: C.brown, fontWeight: '800', fontSize: 18 }}>{formatCount(profile.points ?? 0)}</Text>
            </View>
            <View style={[styles.balanceRow, { backgroundColor: C.card2, marginTop: 8 }]}>
              <Text style={{ color: C.text2 }}>{t('profile.signalStrength')}</Text>
              <Text style={{ color: C.brown, fontWeight: '800', fontSize: 18 }}>{formatCount(profile.karma ?? 0)}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {earnedAchievements.length === 0 ? (
                <Text style={{ color: C.text2, fontSize: 13 }}>{t('profile.achievementsEmpty')}</Text>
              ) : (
                earnedAchievements.map((a) => {
                  const label = typeof a === 'string' ? a : a.title || '';
                  const icon = typeof a === 'string' ? null : a.icon;
                  const key = typeof a === 'string' ? a : String(a.id ?? label);
                  return (
                    <View key={key} style={[styles.pill, { backgroundColor: C.card2, borderWidth: 1, borderColor: C.line }]}>
                      <Text style={{ color: C.brown, fontSize: 12, fontWeight: '700' }}>{icon || '✦'} {label}</Text>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
            <Text style={{ color: C.text, fontWeight: '800', marginBottom: 12 }}>{t('profile.suggestedUsers')}</Text>
            {suggestions.length === 0 ? (
              <Text style={{ color: C.text2, fontSize: 13 }}>{t('profile.suggestionsEmpty')}</Text>
            ) : (
              suggestions.slice(0, 6).map((s) => (
                <Pressable key={String(s.id)} onPress={() => openProfile(navigation, s.username, user?.username)} style={[styles.suggestRow, { backgroundColor: C.card2 }]}>
                  {s.avatar ? (
                    <Image source={{ uri: mediaUrl(s.avatar) }} style={styles.suggestAvatar} />
                  ) : (
                    <LinearGradient colors={[C.brown, C.brownDk]} style={[styles.suggestAvatar, { alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{initials(personName(s, s.username))}</Text>
                    </LinearGradient>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '700' }} numberOfLines={1}>{personName(s, s.username)}</Text>
                    <Text style={{ color: C.text2, fontSize: 12 }} numberOfLines={1}>@{s.username}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>

          {constellations.length > 0 || isOwnProfile ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.constellationRow}>
              {isOwnProfile ? (
                <View style={[styles.constellationCreate, { backgroundColor: C.white, borderColor: C.line }]}>
                  <TextInput
                    value={constellationDraft}
                    onChangeText={setConstellationDraft}
                    placeholder={locale === 'ar' ? 'اسم…' : 'Name…'}
                    placeholderTextColor={C.text2}
                    style={{ color: C.text, fontSize: 13, minWidth: 72, paddingVertical: 4 }}
                    maxLength={40}
                    onSubmitEditing={() => {
                      if (!constellationDraft.trim()) return;
                      void api.createConstellation(constellationDraft.trim()).then(async () => {
                        setConstellationDraft('');
                        if (profile.id) setConstellations(await api.getConstellations(profile.id));
                      });
                    }}
                  />
                  <Pressable
                    onPress={() => {
                      if (!constellationDraft.trim()) return;
                      void api.createConstellation(constellationDraft.trim()).then(async () => {
                        setConstellationDraft('');
                        if (profile.id) setConstellations(await api.getConstellations(profile.id));
                      });
                    }}
                    style={[styles.addDot, { backgroundColor: C.brownDk }]}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>+</Text>
                  </Pressable>
                </View>
              ) : null}
              {constellations.map((item) => (
                <Pressable key={item.id} onPress={() => void openConstellation(item.id)} style={styles.constellationChip}>
                  {item.cover ? (
                    <Image source={{ uri: mediaUrl(item.cover) }} style={styles.constellationCover} />
                  ) : (
                    <View style={[styles.constellationCover, { backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text>✨</Text>
                    </View>
                  )}
                  <Text style={{ color: C.text2, fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{item.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabs, { backgroundColor: C.tabBg }]} contentContainerStyle={{ padding: 4, gap: 4 }}>
            {([
              { key: 'posts' as const, labelKey: 'profile.tabPosts' },
              { key: 'reels' as const, labelKey: 'profile.tabSignals' },
              { key: 'ideas' as const, labelKey: 'profile.tabIdeas' },
              { key: 'challenges' as const, labelKey: 'profile.tabChallenges' },
              { key: 'stories' as const, labelKey: 'profile.tabStories' },
              { key: 'bottles' as const, labelKey: 'profile.tabBottles' },
            ]).map((item) => {
              const active = tab === item.key;
              return (
                <Pressable key={item.key} onPress={() => setTab(item.key)} style={[styles.tabBtn, { backgroundColor: active ? C.white : 'transparent' }]}>
                  <Text style={{ color: active ? C.brown : C.text2, fontWeight: '700', fontSize: 13 }}>{t(item.labelKey)}</Text>
                  {active ? <View style={[styles.tabUnderline, { backgroundColor: C.brown }]} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
            {tab === 'posts' ? (
              mappedPosts.length === 0 ? (
                <EmptyTab emoji="📝" text={t('profile.noPostsYet')} color={C.text2} />
              ) : (
                <View style={styles.grid2}>
                  {mappedPosts.map((post) => {
                    const thumb = postThumb(post);
                    const likes = reactionTotal(post.reaction_counts) || post.likes_count || 0;
                    return (
                      <Pressable
                        key={String(post.id)}
                        onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                        onLongPress={() => {
                          if (!isOwnProfile) return;
                          Alert.alert(t('signal.pinned'), post.is_profile_pinned ? t('signal.unpin') : t('signal.pin'), [
                            { text: t('common.cancel'), style: 'cancel' },
                            {
                              text: post.is_profile_pinned ? t('signal.unpin') : t('signal.pin'),
                              onPress: () => {
                                void api.pinProfilePost(post.id).then((result) => {
                                  setPosts((prev) =>
                                    prev.map((p) =>
                                      String(p.id) === String(post.id) ? { ...p, is_profile_pinned: !!result.is_profile_pinned } : p,
                                    ),
                                  );
                                });
                              },
                            },
                          ]);
                        }}
                        style={[styles.postCard, { backgroundColor: C.white, borderColor: C.line }]}
                      >
                        {thumb ? <Image source={{ uri: thumb }} style={styles.postThumb} /> : <LinearGradient colors={[C.card, C.card2]} style={styles.postThumb} />}
                        {post.is_profile_pinned ? (
                          <View style={styles.pinBadge}>
                            <Text style={styles.pinText}>{t('signal.pinned')}</Text>
                          </View>
                        ) : null}
                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={styles.postStats}>
                          <Text style={styles.postStatText}>♥ {formatCount(likes)}</Text>
                          <Text style={styles.postStatText}>💬 {post.comments_count || 0}</Text>
                        </LinearGradient>
                        <Text style={{ color: C.text, fontSize: 12, fontWeight: '700', padding: 8 }} numberOfLines={1}>
                          {postTitle(post.text, t('profile.untitledPost'))}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )
            ) : null}

            {tab === 'reels' ? (
              <>
                <ReelsGrid
                  C={C}
                  t={t}
                  reels={reels}
                  empty={t('reels.profileEmptyOwn')}
                  onOpen={(id) => navigation.navigate('MainTabs', { screen: 'Signals', params: { focusId: id } })}
                  onCreate={isOwnProfile ? () => navigation.navigate('Create', { mode: 'reel' }) : undefined}
                />
                {isOwnProfile ? (
                  <View style={{ marginTop: 24 }}>
                    <Text style={{ color: C.text, fontWeight: '800', marginBottom: 12 }}>{t('profile.savedSignals')}</Text>
                    <ReelsGrid C={C} t={t} reels={savedReels} empty={t('reels.profileEmptySaved')} onOpen={(id) => navigation.navigate('MainTabs', { screen: 'Signals', params: { focusId: id } })} />
                  </View>
                ) : null}
              </>
            ) : null}

            {tab === 'ideas' ? (
              <IdeasGrid
                C={C}
                t={t}
                locale={locale}
                ideas={ideas}
                isOwn={!!isOwnProfile}
                scope={ideaScope}
                onScope={setIdeaScope}
                onOpen={(id) => navigation.navigate('BazaarDetail', { ideaId: id })}
                onCreate={() => navigation.navigate('Bazaar')}
              />
            ) : null}

            {tab === 'challenges' ? (
              challenges.length === 0 ? (
                <EmptyTab emoji="🏆" text={t('profile.noChallengeEntries')} color={C.text2} />
              ) : (
                <View style={{ gap: 10 }}>
                  {challenges.map((entry) => (
                    <Pressable key={String(entry.id)} onPress={() => navigation.navigate('Lab', { challenge: entry.challenge?.id ?? entry.id })} style={[styles.listCard, { backgroundColor: C.white, borderColor: C.line }]}>
                      <Text style={{ color: C.text, fontWeight: '700' }}>{entry.challenge?.title || t('profile.challengeFallbackTitle')}</Text>
                      {entry.content ? <Text style={{ color: C.text2, fontSize: 12, marginTop: 4 }} numberOfLines={2}>{entry.content}</Text> : null}
                      {entry.is_approved ? (
                        <View style={[styles.pill, { backgroundColor: `${C.brown}22`, marginTop: 8, alignSelf: 'flex-start' }]}>
                          <Text style={{ color: C.brown, fontSize: 10, fontWeight: '700' }}>{t('profile.approvedBadge')}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              )
            ) : null}

            {tab === 'stories' ? (
              stories.length === 0 ? (
                <EmptyTab emoji="📖" text={t('profile.noStoriesInForge')} color={C.text2} />
              ) : (
                <View style={styles.grid2}>
                  {stories.map((story) => (
                    <Pressable key={story.id} onPress={() => navigation.navigate('ForgeDetail', { storyId: story.id })} style={[styles.listCard, { backgroundColor: C.white, borderColor: C.line, padding: 0, overflow: 'hidden', width: POST_W }]}>
                      {story.cover_url ? <Image source={{ uri: mediaUrl(story.cover_url) }} style={{ height: 112, width: '100%' }} /> : <LinearGradient colors={[C.card, C.card2]} style={{ height: 112 }} />}
                      <View style={{ padding: 12 }}>
                        <Text style={{ color: C.text, fontWeight: '700' }} numberOfLines={1}>{story.title}</Text>
                        <Text style={{ color: C.text2, fontSize: 12, marginTop: 4 }}>
                          {t('profile.storyParts', { count: String(story.segment_count ?? 0), max: String(story.max_segments ?? 0), genre: story.genre || '' })}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )
            ) : null}

            {tab === 'bottles' ? (
              bottles.length === 0 ? (
                <EmptyTab emoji="🍾" text={t('profile.noActiveBottles')} color={C.text2} />
              ) : (
                <View style={{ gap: 10 }}>
                  {bottles.map((bottle) => {
                    const m = emotionMeta(bottle.emotion_type);
                    return (
                      <Pressable key={String(bottle.id)} onPress={() => navigation.navigate('Vault')} style={[styles.listCard, { backgroundColor: C.white, borderColor: `${m.color}44` }]}>
                        <View style={[styles.pill, { backgroundColor: `${m.color}22`, alignSelf: 'flex-start' }]}>
                          <Text style={{ color: m.color, fontSize: 12, fontWeight: '600' }}>{m.emoji} {t(m.labelKey)}</Text>
                        </View>
                        <Text style={{ color: C.text, fontSize: 14, marginTop: 8 }} numberOfLines={3}>{bottle.message}</Text>
                        {bottle.expires_at ? (
                          <Text style={{ color: C.text2, fontSize: 11, marginTop: 8 }}>{t('bottles.vanishesIn', { time: formatBottleTimeLeft(bottle.expires_at) })}</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              )
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>

      <StoryViewer visible={storyViewerOpen} stories={storyPlaylist} startIndex={0} onClose={() => setStoryViewerOpen(false)} />
      {followModal && profile ? (
        <FollowListModal
          C={C}
          t={t}
          userId={profile.id}
          mode={followModal}
          title={followModal === 'followers' ? t('profile.followersTitle') : t('profile.followingTitle')}
          myUsername={user?.username}
          navigation={navigation}
          onClose={() => setFollowModal(null)}
        />
      ) : null}
      {tipOpen && profile ? <TipSheet C={C} t={t} recipientId={profile.id} onClose={() => setTipOpen(false)} /> : null}
      {subOpen && profile ? <SubscribeSheet C={C} t={t} tiers={tiers} onClose={() => setSubOpen(false)} /> : null}
      {socialOpen && profile ? (
        <SocialSheet
          C={C}
          t={t}
          userId={profile.id}
          username={profile.username}
          social={profile.social}
          onClose={() => setSocialOpen(false)}
          onUpdate={(social) => setProfile((p) => (p ? { ...p, social } : p))}
          onBlocked={() => {
            setSocialOpen(false);
            setBlocked(true);
          }}
        />
      ) : null}
    </View>
  );
}

const POST_W = (Dimensions.get('window').width - 16 * 2 - 12) / 2;

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cover: { height: 168, width: '100%' },
  coverBack: {
    position: 'absolute',
    left: 12,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(20,16,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverActions: { position: 'absolute', right: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, maxWidth: '78%' },
  coverChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 11, fontWeight: '700' },
  identity: { borderRadius: 28, borderWidth: 1, padding: 16 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 4 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, minHeight: 40 },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, minHeight: 40 },
  roundBtn: { borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  statPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row' },
  panel: { marginHorizontal: 16, marginTop: 20, borderRadius: 16, borderWidth: 1, padding: 16 },
  weekRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  happyBox: { borderRadius: 12, borderWidth: 1, padding: 12 },
  field: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  expCard: { borderRadius: 12, borderWidth: 1, padding: 12 },
  iconBtn: { borderRadius: 8, padding: 6 },
  balanceRow: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between' },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 8, marginBottom: 8 },
  suggestAvatar: { width: 40, height: 40, borderRadius: 20 },
  constellationRow: { paddingHorizontal: 16, paddingTop: 16, gap: 12, alignItems: 'center' },
  constellationCreate: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  addDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  constellationChip: { alignItems: 'center', width: 64, gap: 6 },
  constellationCover: { width: 56, height: 56, borderRadius: 28 },
  tabs: { marginHorizontal: 16, marginTop: 20, borderRadius: 12 },
  tabBtn: { minWidth: 72, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  tabUnderline: { position: 'absolute', bottom: 2, left: 10, right: 10, height: 2, borderRadius: 1 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  postCard: { width: POST_W, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  postThumb: { width: '100%', aspectRatio: 1 },
  postStats: { position: 'absolute', left: 0, right: 0, bottom: 28, flexDirection: 'row', gap: 10, paddingHorizontal: 8, paddingVertical: 6 },
  postStatText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  pinBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  pinText: { color: '#fff', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  listCard: { borderRadius: 12, borderWidth: 1, padding: 14 },
  error: { color: '#E24B4A', fontSize: 12, marginTop: 8 },
});
