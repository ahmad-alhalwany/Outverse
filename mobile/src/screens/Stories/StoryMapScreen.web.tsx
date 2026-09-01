import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useLocale } from '@/i18n/LocaleProvider';
import StoryViewer from '@/components/StoryViewer';
import { asStoryMapPins, STORY_MAP_C, uniquePlaces, type StoryMapPin } from '@/lib/storyMap';
import { StoryMapAtlas, StoryMapPinCard } from './storyMapParts';

export default function StoryMapScreen({ route, navigation }: any) {
  const { t, isRTL } = useLocale();
  const [pins, setPins] = useState<StoryMapPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError('');
    try {
      setPins(asStoryMapPins(await api.getStoryMap()));
    } catch {
      setPins([]);
      setError(t('storyMap.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const stories = useMemo(() => pins.map((p) => p.story), [pins]);
  const latest = useMemo(() => pins.slice(0, 8), [pins]);
  const places = uniquePlaces(pins);

  useEffect(() => {
    const storyId = route?.params?.storyId;
    if (!storyId || !pins.length) return;
    const index = pins.findIndex((pin) => String(pin.id) === String(storyId));
    if (index >= 0) {
      setStoryIndex(index);
      setViewerOpen(true);
    }
  }, [route?.params?.storyId, pins]);

  const openStory = (index: number) => {
    setStoryIndex(index);
    setViewerOpen(true);
  };

  return (
    <LinearGradient colors={['#1a1040', '#0c0a1a', '#0a1628']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={STORY_MAP_C.muted} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={styles.kicker}>
              <Ionicons name="sparkles" size={12} color="#a5f3fc" />
              <Text style={styles.kickerText}>{t('storyMap.liveLocations')}</Text>
            </View>
            <Text style={styles.title}>{t('storyMap.title')}</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('StoryStudio')}
            style={styles.addBtn}
            accessibilityLabel={t('storyMap.addStoryCta')}
          >
            <Ionicons name="add" size={18} color="#fff" />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>{t('storyMap.subtitle')}</Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t('storyMap.pinsStat')}</Text>
            <Text style={styles.statValue}>{pins.length}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t('storyMap.placesStat')}</Text>
            <Text style={styles.statValue}>{places}</Text>
          </View>
        </View>

        {error ? (
          <Pressable onPress={() => void load()} style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retry}>{t('discover.retry')}</Text>
          </Pressable>
        ) : null}

        <View style={styles.mapFrame}>
          {loading ? (
            <View style={styles.mapOverlay}>
              <ActivityIndicator color="#a5f3fc" />
              <Text style={styles.loadingText}>{t('storyMap.loading')}</Text>
            </View>
          ) : (
            <StoryMapAtlas pins={pins} onOpen={openStory} emptyLabel={t('storyMap.emptyMap')} />
          )}
        </View>

        <FlatList
          data={latest}
          keyExtractor={(item) => String(item.id)}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(true);
              }}
              tintColor="#22d3ee"
            />
          }
          ListHeaderComponent={
            <View style={styles.listHead}>
              <Text style={styles.listTitle}>{t('storyMap.latestMapped')}</Text>
              <View style={styles.countChip}>
                <Text style={styles.countChipText}>
                  {pins.length === 1
                    ? t('storyMap.pinsCountOne', { count: '1' })
                    : t('storyMap.pinsCountMany', { count: String(pins.length) })}
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? null : <Text style={styles.emptyList}>{t('storyMap.emptyList')}</Text>
          }
          renderItem={({ item, index }) => (
            <StoryMapPinCard pin={item} onPress={() => openStory(index)} />
          )}
        />

        <StoryViewer
          visible={viewerOpen}
          stories={stories}
          startIndex={storyIndex}
          onClose={() => setViewerOpen(false)}
          onViewStory={(storyId) => void api.viewStory(storyId)}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: STORY_MAP_C.raised,
    borderWidth: 1,
    borderColor: STORY_MAP_C.borderSoft,
  },
  kicker: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34,211,238,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.45)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  kickerText: {
    color: '#a5f3fc',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitle: {
    color: '#d4d0ea',
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: STORY_MAP_C.raised,
    borderWidth: 1,
    borderColor: STORY_MAP_C.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statLabel: { color: '#e9e5ff', fontSize: 12, fontWeight: '700' },
  statValue: { color: STORY_MAP_C.cyan, fontSize: 13, fontWeight: '800' },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.5)',
    backgroundColor: 'rgba(127,29,29,0.55)',
    padding: 12,
  },
  errorText: { color: '#fecaca', fontSize: 13, fontWeight: '700' },
  retry: { color: '#fff', fontSize: 12, fontWeight: '800', marginTop: 6 },
  mapFrame: {
    height: 320,
    marginHorizontal: 16,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.45)',
    backgroundColor: '#0a0818',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,10,26,0.4)',
    padding: 20,
  },
  loadingText: { color: '#ddd6fe', marginTop: 8, fontWeight: '700' },
  list: { flex: 1, marginTop: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: STORY_MAP_C.borderSoft,
  },
  listTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  countChip: {
    borderRadius: 999,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countChipText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  emptyList: { color: '#c4b5fd', fontSize: 13, lineHeight: 20, paddingVertical: 12 },
});
