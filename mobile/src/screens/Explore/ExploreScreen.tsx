import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { openProfile } from '@/lib/nav';
import {
  WorldBackdrop,
  WorldHeader,
  WorldHero,
} from '@/components/world/WorldChrome';
import type { Post, Reel, User } from '@/types';

type Section<T> = { loading: boolean; error: boolean; items: T[] };
const INITIAL = { loading: true, error: false, items: [] as never[] };

type Topic = { tag: string; count?: number };
type CommunityRow = {
  id: number | string;
  slug: string;
  name: string;
  description?: string;
  members_count?: number;
};

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: T[] }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

export default function ExploreScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { t } = useLocale();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Section<Post>>(INITIAL);
  const [topics, setTopics] = useState<Section<Topic>>(INITIAL);
  const [communities, setCommunities] = useState<Section<CommunityRow>>(INITIAL);
  const [people, setPeople] = useState<Section<User>>(INITIAL);
  const [reels, setReels] = useState<Section<Reel>>(INITIAL);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setPosts({ loading: true, error: false, items: [] });
    setTopics({ loading: true, error: false, items: [] });
    setCommunities({ loading: true, error: false, items: [] });
    setPeople({ loading: true, error: false, items: [] });
    setReels({ loading: true, error: false, items: [] });

    void api
      .getPosts({ feed: 'discover', limit: 6, offset: 0 })
      .then((page) => setPosts({ loading: false, error: false, items: (page.results || []) as Post[] }))
      .catch(() => setPosts({ loading: false, error: true, items: [] }));

    void api
      .getTrendingTags()
      .then((rows) => {
        const items = asList<any>(rows)
          .map((row) =>
            typeof row === 'string'
              ? { tag: row }
              : { tag: String(row.tag || row.name || '').replace(/^#/, ''), count: row.count ?? row.posts ?? row.score },
          )
          .filter((row) => row.tag)
          .slice(0, 12);
        setTopics({ loading: false, error: false, items });
      })
      .catch(() => setTopics({ loading: false, error: true, items: [] }));

    void api
      .getCommunities({ ordering: 'trending', limit: 6 })
      .then((page) => setCommunities({ loading: false, error: false, items: (page.results || []).slice(0, 6) as CommunityRow[] }))
      .catch(() => setCommunities({ loading: false, error: true, items: [] }));

    void api
      .getSuggestions(user?.id)
      .then((rows) => setPeople({ loading: false, error: false, items: asList<User>(rows) }))
      .catch(() => setPeople({ loading: false, error: true, items: [] }));

    void api
      .getReelDiscover()
      .then((data: any) => {
        const items = asList<Reel>(data?.trending?.length ? data.trending : data?.fresh).slice(0, 6);
        setReels({ loading: false, error: false, items });
      })
      .catch(() => setReels({ loading: false, error: true, items: [] }));
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('discover.title')}
          subtitle={t('nav.discover')}
          tone="default"
          onBack={() => navigation.goBack()}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />}
        >
          <WorldHero tone="default" eyebrow={t('nav.discover')} title={t('discover.title')} body={t('discover.subtitle')} />

          <Pressable
            onPress={() => navigation.navigate('Search')}
            style={[styles.searchCta, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={t('discover.searchCta')}
          >
            <Ionicons name="search-outline" size={18} color={colors.icon} />
            <Text style={[styles.searchCtaText, { color: colors.textSecondary }]}>{t('discover.searchCta')}</Text>
          </Pressable>

          <Section
            icon="flame-outline"
            iconColor="#F59E0B"
            title={t('discover.posts')}
            seeAll={t('discover.seeAll')}
            onSeeAll={() => navigation.navigate('Search')}
            colors={colors}
            state={posts}
            empty={t('discover.postsEmpty')}
            onRetry={() => void load()}
            t={t}
          >
            {posts.items.map((post) => (
              <PostTeaser
                key={String(post.id)}
                post={post}
                colors={colors}
                onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
              />
            ))}
          </Section>

          <Section
            icon="pricetag-outline"
            iconColor="#34D399"
            title={t('discover.topics')}
            colors={colors}
            state={topics}
            empty={t('discover.topicsEmpty')}
            onRetry={() => void load()}
            t={t}
          >
            <View style={styles.wrapRow}>
              {topics.items.map((topic) => (
                <Pressable
                  key={topic.tag}
                  onPress={() => navigation.navigate('TagFeed', { tag: topic.tag })}
                  style={[styles.topicChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={[styles.topicLabel, { color: colors.text }]}>#{topic.tag}</Text>
                  {topic.count != null ? (
                    <Text style={[styles.topicCount, { color: colors.textSecondary }]}>{topic.count}</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </Section>

          <Section
            icon="people-outline"
            iconColor="#A78BFA"
            title={t('discover.communities')}
            seeAll={t('discover.communitiesSeeAll')}
            onSeeAll={() => navigation.navigate('Communities')}
            colors={colors}
            state={communities}
            empty={t('discover.communitiesEmpty')}
            onRetry={() => void load()}
            t={t}
          >
            {communities.items.map((c) => (
              <Pressable
                key={String(c.id)}
                onPress={() => navigation.navigate('CommunityDetail', { slug: c.slug })}
                style={[styles.communityRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.communityName, { color: colors.text }]} numberOfLines={1}>
                    {c.name}
                  </Text>
                  {c.description ? (
                    <Text style={[styles.communityDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                      {c.description}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.communityCount, { color: colors.textSecondary }]}>
                  {t('communities.memberCount', { count: c.members_count ?? 0 })}
                </Text>
              </Pressable>
            ))}
          </Section>

          <Section
            icon="person-add-outline"
            iconColor="#60A5FA"
            title={t('discover.people')}
            colors={colors}
            state={people}
            empty={t('discover.peopleEmpty')}
            onRetry={() => void load()}
            t={t}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
              {people.items.map((person) => {
                const uri = mediaUrl(person.avatar || '') || person.avatar;
                return (
                  <Pressable
                    key={String(person.id)}
                    onPress={() => openProfile(navigation, person.username, user?.username)}
                    style={[styles.personCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={styles.personAvatar} />
                    ) : (
                      <LinearGradient colors={['#7C3AED', '#2563EB']} style={styles.personFallback}>
                        <Text style={styles.personInitial}>{(person.username || '?').slice(0, 2).toUpperCase()}</Text>
                      </LinearGradient>
                    )}
                    <Text style={[styles.personName, { color: colors.text }]} numberOfLines={1}>
                      {person.username}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Section>

          <Section
            icon="play-circle-outline"
            iconColor="#F472B6"
            title={t('discover.reels')}
            subtitle={t('discover.reelsSub')}
            seeAll={t('discover.reelsSeeAll')}
            onSeeAll={() => navigation.navigate('ReelsDiscover')}
            colors={colors}
            state={reels}
            empty={t('discover.reelsEmpty')}
            onRetry={() => void load()}
            t={t}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
              {reels.items.map((reel) => {
                const uri = mediaUrl(reel.video_url || reel.video || '') || reel.video_url || reel.video;
                return (
                  <Pressable
                    key={String(reel.id)}
                    onPress={() => navigation.navigate('MainTabs', { screen: 'Signals', params: { focusId: reel.id } })}
                    style={[styles.reelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={[styles.reelThumb, { backgroundColor: isDark ? '#1E1740' : '#E9E1FA' }]}>
                      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFillObject} /> : null}
                      <View style={styles.reelVeil}>
                        <Ionicons name="play" size={18} color="#fff" />
                      </View>
                    </View>
                    <Text style={[styles.reelCaption, { color: colors.textSecondary }]} numberOfLines={2}>
                      {reel.caption || '…'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

function Section({
  icon,
  iconColor,
  title,
  subtitle,
  seeAll,
  onSeeAll,
  colors,
  state,
  empty,
  onRetry,
  t,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle?: string;
  seeAll?: string;
  onSeeAll?: () => void;
  colors: { text: string; textSecondary: string; primary: string };
  state: Section<unknown>;
  empty: string;
  onRetry: () => void;
  t: (key: string) => string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name={icon} size={16} color={iconColor} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
          </View>
          {subtitle ? <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        </View>
        {seeAll && onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>{seeAll}</Text>
          </Pressable>
        ) : null}
      </View>
      {state.loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
      ) : state.error ? (
        <Pressable onPress={onRetry} style={styles.retryBox}>
          <Text style={[styles.retryText, { color: colors.textSecondary }]}>{t('discover.loadError')}</Text>
          <Text style={[styles.seeAll, { color: colors.primary }]}>{t('discover.retry')}</Text>
        </Pressable>
      ) : state.items.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>{empty}</Text>
      ) : (
        children
      )}
    </View>
  );
}

function PostTeaser({
  post,
  colors,
  onPress,
}: {
  post: Post;
  colors: { text: string; textSecondary: string; surface: string; border: string; primary: string };
  onPress: () => void;
}) {
  const avatar = mediaUrl(post.user?.avatar || '') || post.user?.avatar;
  const name = post.user?.display_name || post.user?.username || '';
  return (
    <Pressable onPress={onPress} style={[styles.postTeaser, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.postHead}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.postAvatar} />
        ) : (
          <View style={[styles.postAvatar, { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={styles.postInitial}>{(name || '?').slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <Text style={[styles.postName, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Text style={[styles.postText, { color: colors.textSecondary }]} numberOfLines={2}>
        {post.text || '📷'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  searchCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 22,
  },
  searchCtaText: { fontSize: 15 },
  section: { marginBottom: 26 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  sectionSub: { fontSize: 12, marginTop: 4, marginStart: 24 },
  seeAll: { fontSize: 12, fontWeight: '700' },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 18 },
  retryBox: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  retryText: { fontSize: 13 },
  postTeaser: { borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 8 },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  postAvatar: { width: 24, height: 24, borderRadius: 12 },
  postInitial: { color: '#fff', fontSize: 11, fontWeight: '800' },
  postName: { flex: 1, fontSize: 12, fontWeight: '700' },
  postText: { fontSize: 14, lineHeight: 20 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  topicLabel: { fontSize: 13, fontWeight: '700' },
  topicCount: { fontSize: 11 },
  communityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  communityName: { fontSize: 14, fontWeight: '700' },
  communityDesc: { fontSize: 12, marginTop: 2 },
  communityCount: { fontSize: 11, fontWeight: '600' },
  hRow: { gap: 10, paddingBottom: 4 },
  personCard: {
    width: 112,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  personAvatar: { width: 48, height: 48, borderRadius: 24, marginBottom: 8 },
  personFallback: { width: 48, height: 48, borderRadius: 24, marginBottom: 8, alignItems: 'center', justifyContent: 'center' },
  personInitial: { color: '#fff', fontSize: 13, fontWeight: '800' },
  personName: { fontSize: 12, fontWeight: '700', width: '100%', textAlign: 'center' },
  reelCard: { width: 112, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  reelThumb: { width: 112, aspectRatio: 9 / 16 },
  reelVeil: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,8,28,0.22)',
  },
  reelCaption: { fontSize: 11, paddingHorizontal: 6, paddingVertical: 6 },
});
