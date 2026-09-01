import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';

type DiscoverPayload = {
  trending?: any[];
  featured?: any[];
  fresh?: any[];
};

/** TikTok Discover → Cosonova Signal Map for reels. */
export default function ReelsDiscoverScreen() {
  const { colors } = useTheme();
  const { t } = useLocale();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<DiscoverPayload | null>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [discover, music] = await Promise.all([api.getReelDiscover(), api.getReelMusic()]);
        setData(discover);
        setTracks(music.slice(0, 12));
      } catch {
        setData(null);
        setTracks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openReel = (id: number) => {
    navigation.navigate('MainTabs', { screen: 'Signals', params: { focusId: id } });
  };

  const openTrack = (track: any) => {
    navigation.navigate('Sound', { musicTrack: track.id, track });
  };

  const Lane = ({ title, rows }: { title: string; rows: any[] }) => {
    if (!rows?.length) return null;
    return (
      <View style={styles.lane}>
        <Text style={[styles.laneTitle, { color: colors.text }]}>{title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {rows.map((r) => (
            <Pressable key={r.id} style={styles.card} onPress={() => openReel(r.id)}>
              <View style={[styles.thumb, { backgroundColor: 'rgba(124,58,237,0.2)' }]}>
                {r.video ? (
                  <Image
                    source={{ uri: mediaUrl(r.video) || r.video }}
                    style={StyleSheet.absoluteFillObject}
                  />
                ) : (
                  <Text style={{ color: '#A78BFA', fontSize: 22 }}>▶</Text>
                )}
              </View>
              <Text style={[styles.cardCaption, { color: colors.textSecondary }]} numberOfLines={2}>
                {r.caption || 'Signal'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <WorldBackdrop tone="live">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title={t('reels.discoverTitle')}
          subtitle={t('reels.discoverSub')}
          tone="live"
          onBack={() => navigation.goBack()}
        />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {t('reels.discoverSub')}
          </Text>

          <View style={styles.lane}>
            <Text style={[styles.laneTitle, { color: colors.text }]}>{t('reels.soundTitle')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {tracks.map((track) => (
                <Pressable
                  key={track.id}
                  onPress={() => openTrack(track)}
                  style={[styles.trackChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={{ color: '#A78BFA', fontWeight: '800' }}>♪</Text>
                  <View style={{ marginLeft: 8 }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{track.title}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                      {track.artist_label || 'Cosonova'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <Lane title={t('reels.trending')} rows={data?.trending || []} />
          <Lane title={t('reels.featured')} rows={data?.featured || []} />
          <Lane title={t('reels.fresh')} rows={data?.fresh || []} />
        </ScrollView>
      )}
      </SafeAreaView>
    </WorldBackdrop>
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
  title: { fontSize: 17, fontWeight: '800' },
  sub: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  lane: { marginTop: 18, paddingLeft: 16 },
  laneTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  card: { width: 110 },
  thumb: {
    width: 110,
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCaption: { fontSize: 11, marginTop: 6 },
  trackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 160,
  },
});
