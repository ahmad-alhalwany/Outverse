import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Callout, Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
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

const DEFAULT_REGION: Region = {
  latitude: 24.7136,
  longitude: 46.6753,
  latitudeDelta: 24,
  longitudeDelta: 24,
};

export default function StoryMapScreen({ route, navigation }: any) {
  const { colors } = useTheme();
  const mapRef = useRef<MapView>(null);
  const [rows, setRows] = useState<StoryMapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);

  const load = useCallback(async (isRefresh = false, nextRegion?: Region) => {
    try {
      const r = nextRegion || region;
      const data = await api.getStoryMap({
        min_lat: r.latitude - r.latitudeDelta,
        max_lat: r.latitude + r.latitudeDelta,
        min_lng: r.longitude - r.longitudeDelta,
        max_lng: r.longitude + r.longitudeDelta,
      });
      setRows(Array.isArray(data) ? (data as StoryMapRow[]) : []);
    } catch (error) {
      console.error('Failed to load story map:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [region]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        const next: Region = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          latitudeDelta: 0.35,
          longitudeDelta: 0.35,
        };
        setRegion(next);
        mapRef.current?.animateToRegion(next, 600);
      } catch {
        /* permission optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stories = useMemo(() => rows.map(rowStory), [rows]);

  const pins = useMemo(
    () =>
      rows
        .map((row, index) => {
          const lat = coordinate(row, ['location_lat', 'latitude', 'lat']);
          const lng = coordinate(row, ['location_lng', 'longitude', 'lng']);
          if (lat == null || lng == null) return null;
          return { row, index, lat, lng };
        })
        .filter(Boolean) as Array<{ row: StoryMapRow; index: number; lat: number; lng: number }>,
    [rows],
  );

  useEffect(() => {
    if (!pins.length || loading) return;
    mapRef.current?.fitToCoordinates(
      pins.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 60, right: 40, bottom: 180, left: 40 }, animated: true },
    );
  }, [pins.length, loading]);

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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
        >
          <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Story Map</Text>
        <Pressable
          onPress={() => {
            setRefreshing(true);
            void load(true);
          }}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Refresh map"
          hitSlop={10}
        >
          <Text style={{ fontSize: 16, color: colors.primary }}>↻</Text>
        </Pressable>
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          onRegionChangeComplete={(next) => setRegion(next)}
          userInterfaceStyle="dark"
          accessibilityLabel="Story location map"
        >
          {pins.map(({ row, index, lat, lng }) => {
            const story = rowStory(row);
            const author = story.user || story.author;
            return (
              <Marker
                key={String(story.id ?? index)}
                coordinate={{ latitude: lat, longitude: lng }}
                onCalloutPress={() => openStory(index)}
              >
                <Callout onPress={() => openStory(index)}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle} numberOfLines={1}>
                      @{author?.username || 'story'}
                    </Text>
                    <Text style={styles.calloutMeta} numberOfLines={2}>
                      {row.location_name || 'Pinned story'}
                    </Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>
        {loading ? (
          <View style={styles.mapLoading}>
            <ActivityIndicator color="#818CF8" />
          </View>
        ) : null}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item, index) => String(rowStory(item).id ?? index)}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
            colors={['#6366F1']}
          />
        }
        ListHeaderComponent={
          <Text style={[styles.listTitle, { color: colors.text }]}>
            {pins.length} mapped {pins.length === 1 ? 'story' : 'stories'}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: colors.textSecondary }}>No mapped stories yet.</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const story = rowStory(item);
          const lat = coordinate(item, ['location_lat', 'latitude', 'lat']);
          const lng = coordinate(item, ['location_lng', 'longitude', 'lng']);
          const uri = mediaUrl(story.image || story.media || story.video || '');
          const author = story.user || story.author;
          return (
            <Pressable
              onPress={() => openStory(index)}
              accessibilityRole="button"
              accessibilityLabel={`Open story by ${author?.username || 'user'}`}
              hitSlop={6}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
              ]}
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
                  {item.location_name || 'Pinned story'}
                  {lat != null && lng != null ? ` · ${lat.toFixed(3)}, ${lng.toFixed(3)}` : ''}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 44, alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  mapWrap: { height: 320, backgroundColor: '#0A0A0F' },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,15,0.35)',
  },
  callout: { minWidth: 140, maxWidth: 200 },
  calloutTitle: { fontWeight: '800', fontSize: 13, color: '#111' },
  calloutMeta: { fontSize: 11, color: '#555', marginTop: 2 },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 32 },
  listTitle: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 12,
  },
  thumb: { width: 64, height: 80, borderRadius: 12, backgroundColor: '#111827' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  thumbIcon: { color: '#fff', fontSize: 20 },
  title: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 3 },
  empty: { padding: 24, alignItems: 'center' },
});
