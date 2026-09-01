import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import StoriesBar from '@/components/StoriesBar';
import { mediaUrl } from '@/api/config';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import type { Story } from '@/types';

type FeedMode = 'all' | 'following';

export default function HomeStoriesRail({
  stories,
  spotlight,
  feedMode,
  onFeedMode,
  onStoryPress,
  onSpotlightPress,
  onAddStory,
}: {
  stories: Story[];
  spotlight: Story[];
  feedMode: FeedMode;
  onFeedMode: (mode: FeedMode) => void;
  onStoryPress: (story: Story, index: number) => void;
  onSpotlightPress: (index: number) => void;
  onAddStory: () => void;
}) {
  const { colors, isDark } = useTheme();
  const { t } = useLocale();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.rail, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {spotlight.length > 0 ? (
        <View style={styles.spotlightBlock}>
          <View style={styles.spotlightHead}>
            <View style={styles.titleRow}>
              <Ionicons name="sparkles" size={14} color={colors.bazaar} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('mobile.spotlight')}</Text>
            </View>
            <Text style={[styles.featured, { color: colors.textSecondary }]}>{t('mobile.featuredSnaps')}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.spotRow}>
            {spotlight.map((story, index) => {
              const uri = mediaUrl(story.image || story.media || story.video || '') || '';
              const name = story.user?.username || story.author?.username || 'story';
              return (
                <Pressable key={String(story.id)} onPress={() => onSpotlightPress(index)} style={styles.spotCard}>
                  {uri ? (
                    <Image source={{ uri }} style={styles.spotImage} />
                  ) : (
                    <LinearGradient colors={['#7C3AED', '#2196F3']} style={styles.spotFallback}>
                      <Text style={styles.spotFallbackText}>★</Text>
                    </LinearGradient>
                  )}
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.spotOverlay}>
                    <Text style={styles.spotName} numberOfLines={1}>
                      {name}
                    </Text>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Ionicons name="sparkles" size={14} color={colors.vault} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('mobile.cosmicStories')}</Text>
          </View>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>{t('mobile.storiesSubtitle')}</Text>
        </View>
        <View style={styles.tools}>
          <View style={[styles.mode, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceSecondary }]}>
            {(['all', 'following'] as const).map((mode) => {
              const active = feedMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => onFeedMode(mode)}
                  style={[styles.modeBtn, active && { backgroundColor: colors.vault }]}
                >
                  <Text style={{ color: active ? '#fff' : colors.textSecondary, fontSize: 10, fontWeight: '700' }}>
                    {mode === 'all' ? t('mobile.storiesAll') : t('feed.feedFollowing')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => navigation.navigate('Highlights')}
            style={[styles.iconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceSecondary }]}
            accessibilityLabel="Story archive"
          >
            <Ionicons name="archive-outline" size={16} color={colors.icon} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('StoryMap')}
            style={[styles.iconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceSecondary }]}
            accessibilityLabel={t('mobile.map')}
          >
            <Ionicons name="location-outline" size={16} color={colors.icon} />
          </Pressable>
          <Pressable onPress={onAddStory} style={styles.addStory}>
            <LinearGradient colors={['#6A00FF', '#A259FF', '#00DBDE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.addStoryInner}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addStoryText}>{t('mobile.addStory')}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      {stories.length === 0 ? (
        <Pressable onPress={onAddStory} style={[styles.empty, { borderColor: colors.border }]}>
          <Text style={styles.emptyEmoji}>✨</Text>
          <Text style={[styles.emptyText, { color: colors.text }]}>{t('mobile.launchFirstStory')}</Text>
        </Pressable>
      ) : (
        <StoriesBar stories={stories} onStoryPress={onStoryPress} embedded />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  spotlightBlock: { marginBottom: 16 },
  spotlightHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '800' },
  featured: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  spotRow: { gap: 12, paddingRight: 4 },
  spotCard: {
    width: 112,
    height: 144,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  spotImage: { width: '100%', height: '100%' },
  spotFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  spotFallbackText: { color: '#fff', fontSize: 22 },
  spotOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 8 },
  spotName: { color: '#fff', fontSize: 12, fontWeight: '700' },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  sub: { fontSize: 12, marginTop: 2 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '62%' },
  mode: { flexDirection: 'row', borderRadius: 999, padding: 2 },
  modeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, minHeight: 28, justifyContent: 'center' },
  iconBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addStory: { borderRadius: 999, overflow: 'hidden' },
  addStoryInner: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, minHeight: 36 },
  addStoryText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { borderWidth: 1, borderRadius: 12, paddingVertical: 24, alignItems: 'center' },
  emptyEmoji: { fontSize: 22, marginBottom: 8 },
  emptyText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
