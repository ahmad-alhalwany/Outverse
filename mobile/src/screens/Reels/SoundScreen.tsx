import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { formatCount } from '@/lib/profileEmotions';
import { useShopPalette } from '@/lib/shop';
import type { MusicTrack, Reel } from '@/types';

type SoundRouteParams = {
  musicTrack?: string | number;
  musicTrackId?: string | number;
  music_track?: string | number;
  track?: MusicTrack;
};

export default function SoundScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDark } = useTheme();
  const C = useShopPalette(isDark);
  const { t, isRTL } = useLocale();
  const params = (route.params || {}) as SoundRouteParams;
  const trackId = Number(params.musicTrack ?? params.musicTrackId ?? params.music_track ?? params.track?.id);

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [track, setTrack] = useState<MusicTrack | null>(params.track || null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
    };
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      setTracks((await api.getReelMusic()) as MusicTrack[]);
    } catch {
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrack = useCallback(async () => {
    if (!Number.isFinite(trackId)) return;
    setLoading(true);
    try {
      const [detail, reelPage] = await Promise.all([
        params.track ? Promise.resolve(params.track) : api.getReelMusicTrack(trackId).catch(() => null),
        api.getReels({ limit: 40, offset: 0, music_track: trackId }),
      ]);
      if (detail) setTrack(detail as MusicTrack);
      setReels((reelPage.results || []) as Reel[]);
    } catch {
      setReels([]);
    } finally {
      setLoading(false);
    }
  }, [params.track, trackId]);

  useEffect(() => {
    if (Number.isFinite(trackId)) void loadTrack();
    else void loadCatalog();
  }, [loadCatalog, loadTrack, trackId]);

  const playPreview = async () => {
    const url = mediaUrl(track?.audio_url || '');
    if (!url) return;
    try {
      await soundRef.current?.unloadAsync();
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
      soundRef.current = sound;
    } catch {
      /* preview optional */
    }
  };

  if (!Number.isFinite(trackId)) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.cream }]} edges={['top']}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={10}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={16} color={C.text2} />
          <Text style={[styles.backText, { color: C.text2 }]}>{t('reels.backToReels')}</Text>
        </Pressable>
        <Text style={[styles.pageTitle, { color: C.text }]}>{t('reels.originalSound')}</Text>
        {loading ? (
          <ActivityIndicator color={C.brown} style={{ marginTop: 32 }} />
        ) : (
          <FlatList
            data={tracks}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={[styles.empty, { color: C.text2 }]}>{t('reels.soundEmpty')}</Text>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => navigation.push('Sound', { musicTrack: item.id, track: item })}
                style={[styles.trackRow, { backgroundColor: C.white, borderColor: C.line }]}
              >
                <View style={[styles.note, { backgroundColor: C.card }]}>
                  <Ionicons name="musical-notes" size={22} color={C.brown} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.trackTitle, { color: C.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.meta, { color: C.text2 }]}>{item.artist_label || item.artist || 'Cosonova'}</Text>
                </View>
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={C.brown} />
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  const title = track?.title || t('reels.soundTitle');
  const artist = track?.artist_label || track?.artist || 'Cosonova';
  const coverUrl = track?.cover_url || track?.cover_art_url;
  const audioUrl = mediaUrl(track?.audio_url || '');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.cream }]} edges={['top']}>
      <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={10}>
        <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={16} color={C.text2} />
        <Text style={[styles.backText, { color: C.text2 }]}>{t('reels.backToReels')}</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={[styles.cover, { backgroundColor: C.card }]}>
          {coverUrl ? (
            <Image source={{ uri: mediaUrl(coverUrl) || coverUrl }} style={StyleSheet.absoluteFillObject} />
          ) : (
            <Ionicons name="musical-notes" size={28} color={C.brown} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageTitle, { color: C.text, marginHorizontal: 0 }]} numberOfLines={2}>{title}</Text>
          <Text style={[styles.meta, { color: C.text2 }]}>{artist}</Text>
          <Text style={[styles.meta, { color: C.text2 }]}>
            {reels.length === 1
              ? t('reels.soundSignals', { count: reels.length })
              : t('reels.soundSignalsPlural', { count: reels.length })}
          </Text>
        </View>
      </View>

      {audioUrl ? (
        <View style={[styles.player, { backgroundColor: C.white, borderColor: C.line }]}>
          <Pressable onPress={() => void playPreview()} style={[styles.useBtn, { backgroundColor: C.card }]}>
            <Ionicons name="play" size={16} color={C.brownDk} />
            <Text style={{ color: C.brownDk, fontWeight: '700' }}>{t('common.continue')}</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Create', { mode: 'reel', music_track: trackId })}
            style={[styles.useBtn, { backgroundColor: C.brownDk }]}
          >
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700' }}>{t('reels.useThisSound')}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => navigation.navigate('Create', { mode: 'reel', music_track: trackId })}
          style={[styles.useFull, { backgroundColor: C.brownDk }]}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>{t('reels.useThisSound')}</Text>
        </Pressable>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.brown} />
          <Text style={[styles.meta, { color: C.text2, marginTop: 8 }]}>{t('reels.soundLoading')}</Text>
        </View>
      ) : (
        <FlatList
          data={reels}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 12 }}
          ListEmptyComponent={
            <View>
              <Text style={[styles.empty, { color: C.text2 }]}>{t('reels.soundEmpty')}</Text>
              <Pressable onPress={() => navigation.navigate('Create', { mode: 'reel', music_track: trackId })}>
                <Text style={{ color: C.brown, fontWeight: '700', textAlign: 'center', marginTop: 10 }}>
                  {t('reels.soundBeFirst')}
                </Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const video = item.video_url || item.video;
            return (
              <Pressable
                onPress={() => navigation.navigate('Reels', { reelId: item.id })}
                style={[styles.reelCard, { backgroundColor: C.white, borderColor: C.line }]}
              >
                <View style={[styles.thumb, { backgroundColor: C.card }]}>
                  {video ? (
                    <Image source={{ uri: mediaUrl(video) || video }} style={StyleSheet.absoluteFillObject} />
                  ) : (
                    <Ionicons name="play" size={22} color={C.brown} />
                  )}
                  <Text style={styles.views}>▶ {formatCount(item.views || 0)}</Text>
                </View>
                <Text style={[styles.caption, { color: C.text }]} numberOfLines={2}>
                  {(item.caption || t('reels.signalFallback')).slice(0, 42)}
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
  safe: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 8, marginBottom: 10 },
  backText: { fontSize: 14, fontWeight: '600' },
  pageTitle: { fontSize: 22, fontWeight: '800', marginHorizontal: 16, marginBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10 },
  note: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  trackTitle: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 3 },
  empty: { textAlign: 'center', marginTop: 24, fontSize: 14 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, marginBottom: 16 },
  cover: { width: 64, height: 64, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  player: { marginHorizontal: 16, marginBottom: 12, borderRadius: 18, borderWidth: 1, padding: 12, flexDirection: 'row', gap: 8 },
  useBtn: { flex: 1, borderRadius: 999, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  useFull: { marginHorizontal: 16, marginBottom: 12, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  center: { alignItems: 'center', marginTop: 36 },
  grid: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  reelCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 8 },
  thumb: { height: 200, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  views: { position: 'absolute', left: 8, bottom: 8, color: '#fff', fontSize: 11, fontWeight: '700' },
  caption: { fontSize: 12, fontWeight: '700', marginTop: 8 },
});
