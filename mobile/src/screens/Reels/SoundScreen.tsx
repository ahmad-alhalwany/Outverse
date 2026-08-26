import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useTheme } from '@/hooks/useTheme';
import type { MusicTrack, Reel } from '@/types';

type SoundRouteParams = {
  musicTrack?: string | number;
  musicTrackId?: string | number;
  music_track?: string | number;
  track?: MusicTrack;
};

export default function SoundScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params || {}) as SoundRouteParams;
  const trackId = Number(params.musicTrack ?? params.musicTrackId ?? params.music_track ?? params.track?.id);
  const [track, setTrack] = useState<MusicTrack | null>(params.track || null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!Number.isFinite(trackId)) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      setLoading(true);
      try {
        const [musicRows, reelPage] = await Promise.all([
          track ? Promise.resolve([]) : api.getReelMusic(),
          api.getReels({ limit: 40, offset: 0, music_track: trackId }),
        ]);
        if (cancelled) return;
        if (!track) {
          const found = (musicRows as MusicTrack[]).find((item) => Number(item.id) === trackId);
          setTrack(found || null);
        }
        setReels((reelPage.results || []) as Reel[]);
      } catch {
        if (!cancelled) {
          setReels([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trackId]);

  const title = track?.title || 'Signal track';
  const artist = track?.artist || track?.artist_label || 'Cosonova';
  const coverUrl = track?.cover_url || track?.cover_art_url;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Sound</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cover}>
          {coverUrl ? (
            <Image
              source={{ uri: mediaUrl(coverUrl) || coverUrl }}
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <Text style={styles.coverIcon}>♪</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>{title}</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{artist}</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 6, fontSize: 12 }}>
            {reels.length} {reels.length === 1 ? 'signal' : 'signals'} using this track
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => navigation.navigate('Create', { mode: 'reel', music_track: trackId })}
        disabled={!Number.isFinite(trackId)}
        style={[styles.useButton, { backgroundColor: '#7C3AED', opacity: Number.isFinite(trackId) ? 1 : 0.5 }]}
      >
        <Text style={styles.useButtonText}>Use this track</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator color="#A78BFA" style={{ marginTop: 36 }} />
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
          columnWrapperStyle={{ gap: 12 }}
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 24 }}>
              No signals have used this track yet.
            </Text>
          }
          renderItem={({ item }) => {
            const video = item.video_url || item.video;
            return (
              <Pressable
                onPress={() => navigation.navigate('Reels')}
                style={[styles.reelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.thumb}>
                  {video ? (
                    <Image source={{ uri: mediaUrl(video) || video }} style={StyleSheet.absoluteFillObject} />
                  ) : (
                    <Text style={{ color: '#A78BFA', fontSize: 22 }}>▶</Text>
                  )}
                </View>
                <Text style={[styles.caption, { color: colors.text }]} numberOfLines={2}>
                  {item.caption || 'Signal'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  {item.likes_count || 0} sparks
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  hero: {
    margin: 16,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cover: {
    width: 76,
    height: 76,
    borderRadius: 18,
    backgroundColor: 'rgba(124,58,237,0.22)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverIcon: { color: '#A78BFA', fontSize: 30, fontWeight: '800' },
  title: { fontSize: 18, fontWeight: '900' },
  useButton: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  useButtonText: { color: '#fff', fontWeight: '800' },
  reelCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
  },
  thumb: {
    height: 210,
    borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.18)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 3 },
});
