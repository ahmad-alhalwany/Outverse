import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import {
  asBoardPins,
  asPublicBoard,
  asPublicBoards,
  useBoardsPalette,
  type BoardPin,
  type PublicBoardInfo,
} from '@/lib/boards';

export default function PublicBoardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDark } = useTheme();
  const C = useBoardsPalette(isDark);
  const { t } = useLocale();
  const collectionId = route.params?.collectionId;

  const [boards, setBoards] = useState<PublicBoardInfo[]>([]);
  const [collection, setCollection] = useState<PublicBoardInfo | null>(null);
  const [pins, setPins] = useState<BoardPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      if (!collectionId) {
        setBoards(asPublicBoards(await api.getCollections()));
        setCollection(null);
        setPins([]);
      } else {
        const board = await api.getPublicBoard(collectionId);
        const next = asPublicBoard(board.collection);
        setCollection(next);
        setPins(asBoardPins(board.items));
        if (!next) setError(t('boards.notFound'));
      }
    } catch {
      setBoards([]);
      setCollection(null);
      setPins([]);
      setError(collectionId ? t('boards.notFoundOrPrivate') : t('boards.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [collectionId, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const headerCount = collection?.item_count ?? pins.length;

  const columns = useMemo(() => {
    const left: BoardPin[] = [];
    const right: BoardPin[] = [];
    pins.forEach((pin, index) => {
      (index % 2 === 0 ? left : right).push(pin);
    });
    return { left, right };
  }, [pins]);

  if (!collectionId) {
    return (
      <WorldBackdrop tone="vault">
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <WorldHeader
            title={t('nav.boards')}
            subtitle={t('boards.hubSubtitle')}
            tone="vault"
            onBack={() => navigation.goBack()}
          />
          {loading && boards.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color={C.brown} />
              <Text style={[styles.hint, { color: C.text2 }]}>{t('boards.loading')}</Text>
            </View>
          ) : (
            <FlatList
              data={boards}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.hubList}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />
              }
              ListEmptyComponent={
                <View style={[styles.empty, { backgroundColor: C.card2 }]}>
                  <Text style={[styles.hint, { color: C.text2 }]}>{error || t('boards.emptyHub')}</Text>
                </View>
              }
              renderItem={({ item }) => {
                const cover = item.cover_url ? mediaUrl(item.cover_url) : '';
                return (
                  <Pressable
                    onPress={() => navigation.push('PublicBoard', { collectionId: item.id })}
                    style={[styles.hubCard, { backgroundColor: C.white, borderColor: C.line }]}
                  >
                    {cover ? <Image source={{ uri: cover }} style={styles.hubCover} /> : null}
                    <View style={styles.hubBody}>
                      <Text style={[styles.kicker, { color: C.brown }]}>{t('boards.publicBoard')}</Text>
                      <Text style={[styles.hubTitle, { color: C.text }]}>{item.name}</Text>
                      {item.description ? (
                        <Text style={[styles.hubDesc, { color: C.text2 }]} numberOfLines={2}>
                          {item.description}
                        </Text>
                      ) : null}
                      <Text style={[styles.hubMeta, { color: C.text2 }]}>
                        {t('boards.savedPostsCount', { count: item.item_count })}
                      </Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </SafeAreaView>
      </WorldBackdrop>
    );
  }

  return (
    <WorldBackdrop tone="vault">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={collection?.name || t('nav.boards')}
          subtitle={t('boards.publicBoard')}
          tone="vault"
          onBack={() => navigation.goBack()}
        />
        {loading && !collection ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.brown} />
            <Text style={[styles.hint, { color: C.text2 }]}>{t('boards.loading')}</Text>
          </View>
        ) : error || !collection ? (
          <View style={styles.center}>
            <Text style={[styles.hint, { color: C.text2 }]}>{error || t('boards.notFound')}</Text>
            <Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: C.brownDk }]}>
              <Text style={styles.retryText}>{t('common.tryAgain')}</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={[{ key: 'masonry' }]}
            keyExtractor={(item) => item.key}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />
            }
            contentContainerStyle={styles.detail}
            ListHeaderComponent={
              <>
                <Pressable onPress={() => navigation.navigate('Saved')} style={styles.backSaved}>
                  <Text style={[styles.backSavedText, { color: C.brown }]}>{t('boards.backToSaved')}</Text>
                </Pressable>
                <View style={[styles.hero, { backgroundColor: C.card, borderColor: C.line }]}>
                  <View style={styles.heroKicker}>
                    <Ionicons name="grid-outline" size={14} color={C.brown} />
                    <Text style={[styles.kicker, { color: C.brown }]}>{t('boards.publicBoard')}</Text>
                  </View>
                  <Text style={[styles.heroTitle, { color: C.text }]}>{collection.name}</Text>
                  {collection.description ? (
                    <Text style={[styles.heroDesc, { color: C.text2 }]}>{collection.description}</Text>
                  ) : null}
                  <Text style={[styles.hubMeta, { color: C.text2 }]}>
                    {t('boards.savedPostsCount', { count: headerCount })}
                  </Text>
                </View>
              </>
            }
            renderItem={() =>
              pins.length === 0 ? (
                <View style={[styles.empty, { backgroundColor: C.card2 }]}>
                  <Text style={[styles.hint, { color: C.text2 }]}>{t('boards.emptyPublicBoard')}</Text>
                </View>
              ) : (
                <View style={styles.masonry}>
                  {[columns.left, columns.right].map((col, colIndex) => (
                    <View key={colIndex} style={styles.column}>
                      {col.map((pin, index) => {
                        const tall = (colIndex + index) % 3 === 0;
                        return (
                          <Pressable
                            key={pin.id}
                            onPress={() => navigation.navigate('PostDetail', { postId: pin.id })}
                            style={[styles.pin, { backgroundColor: C.white, borderColor: C.line }]}
                          >
                            <Image
                              source={{ uri: pin.image }}
                              style={{ width: '100%', height: tall ? 220 : 160 }}
                              resizeMode="cover"
                            />
                            <View style={styles.pinBody}>
                              <Text style={[styles.pinText, { color: C.text }]} numberOfLines={2}>
                                {pin.text || t('boards.untitledPost')}
                              </Text>
                              {pin.author ? (
                                <Text style={[styles.pinAuthor, { color: C.text2 }]} numberOfLines={1}>
                                  {pin.author}
                                </Text>
                              ) : null}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              )
            }
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: { fontSize: 14, textAlign: 'center', marginTop: 10 },
  retry: { marginTop: 14, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  hubList: { paddingHorizontal: 16, paddingBottom: 36 },
  hubCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginBottom: 12 },
  hubCover: { width: '100%', height: 120 },
  hubBody: { padding: 16 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  hubTitle: { fontSize: 18, fontWeight: '800', marginTop: 6 },
  hubDesc: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  hubMeta: { fontSize: 12, marginTop: 8 },
  empty: { borderRadius: 18, padding: 28, alignItems: 'center', marginTop: 8 },
  detail: { paddingHorizontal: 16, paddingBottom: 40 },
  backSaved: { marginBottom: 12 },
  backSavedText: { fontSize: 13, fontWeight: '700' },
  hero: { borderRadius: 28, borderWidth: 1, padding: 20, marginBottom: 16 },
  heroKicker: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  heroTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heroDesc: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  masonry: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  column: { flex: 1, gap: 12 },
  pin: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  pinBody: { padding: 12 },
  pinText: { fontSize: 13, fontWeight: '700' },
  pinAuthor: { fontSize: 11, marginTop: 4 },
});
