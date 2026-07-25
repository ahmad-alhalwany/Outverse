import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useTheme } from '@/hooks/useTheme';
import StoryViewer from '@/components/StoryViewer';
import type { Story } from '@/types';

type StoryMapRow = Story & {
  story?: Story;
  latitude?: number | string | null;
  longitude?: number | string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  location_lat?: number | string | null;
  location_lng?: number | string | null;
  location_name?: string | null;
};

function rowStory(row: StoryMapRow): Story {
  return (row.story || row) as Story;
}

function coordinate(row: StoryMapRow, keys: Array<keyof StoryMapRow>) {
  for (const key of keys) {
    const value = row[key];
    const numberValue = typeof value === 'string' ? Number.parseFloat(value) : value;
    if (typeof numberValue === 'number' && Number.isFinite(numberValue)) return numberValue;
  }
  return null;
}

export default function StoryMapScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const [rows, setRows] = useState<StoryMapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);

  const load = useCallback(async (isRefresh = false) => {
    try {
      const data = await api.getStoryMap();
      setRows(Array.isArray(data) ? (data as StoryMapRow[]) : []);
    } catch (error) {
      console.error('Failed to load story map:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stories = useMemo(() => rows.map(rowStory), [rows]);

  useEffect(() => {
    const storyId = route?.params?.storyId;
    if (!storyId || !stories.length) return;
    const index = stories.findIndex((story) => String(story.id) === String(storyId));
    if (index >= 0) {
      setStoryIndex(index);
      setViewerOpen(true);
    }
  }, [route?.params?.storyId, stories]);

  const openStory = (index: number) => {
    setStoryIndex(index);
    setViewerOpen(true);
  };

  const renderItem = ({ item, index }: { item: StoryMapRow; index: number }) => {
    const story = rowStory(item);
    const lat = coordinate(item, ['latitude', 'lat', 'location_lat']);
    const lng = coordinate(item, ['longitude', 'lng', 'location_lng']);
    const uri = mediaUrl(story.image || story.media || story.video || '');
    const author = story.user || story.author;

    return (
      <TouchableOpacity
        onPress={() => openStory(index)}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.85}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Text style={styles.thumbIcon}>◎</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            @{author?.username || 'story'}
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {item.location_name || 'Pinned story'}{lat != null && lng != null ? ` · ${lat.toFixed(4)}, ${lng.toFixed(4)}` : ''}
          </Text>
          {story.text ? (
            <Text style={[styles.body, { color: colors.text }]} numberOfLines={2}>
              {story.text}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Story Map</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, index) => String(rowStory(item).id ?? index)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(true);
              }}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            <View style={[styles.mapFallback, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.mapTitle, { color: colors.text }]}>Nearby story pins</Text>
              <Text style={[styles.mapText, { color: colors.textSecondary }]}>
                Map packages are not installed, so pins are shown as location cards.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ color: colors.textSecondary }}>No mapped stories yet.</Text>
            </View>
          }
        />
      )}

      <StoryViewer
        visible={viewerOpen}
        stories={stories}
        startIndex={storyIndex}
        onClose={() => setViewerOpen(false)}
        onViewStory={(storyId) => void api.viewStory(storyId)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 44, alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 32 },
  mapFallback: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  mapTitle: { fontSize: 17, fontWeight: '800' },
  mapText: { fontSize: 13, lineHeight: 18, marginTop: 5 },
  card: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 10, flexDirection: 'row', gap: 12 },
  thumb: { width: 72, height: 96, borderRadius: 14, backgroundColor: '#111827' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbIcon: { color: '#fff', fontSize: 22 },
  title: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 3 },
  body: { fontSize: 13, lineHeight: 18, marginTop: 6 },
  empty: { padding: 32, alignItems: 'center' },
});
