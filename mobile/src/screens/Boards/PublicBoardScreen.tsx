import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import type { Post } from '@/types';

const GAP = 3;
const CELL = (Dimensions.get('window').width - GAP * 2) / 3;

type PublicBoardProps = {
  route: { params?: { collectionId?: string | number } };
  navigation: any;
};

function postThumb(post: Post): string {
  const media = post.media?.[0];
  return mediaUrl(media?.thumbnail_url || media?.thumbnail || media?.media_file || media?.url || media?.file || '');
}

export default function PublicBoardScreen({ route, navigation }: PublicBoardProps) {
  const { colors } = useTheme();
  const collectionId = route.params?.collectionId;
  const [collection, setCollection] = useState<Record<string, unknown> | null>(null);
  const [items, setItems] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const title = useMemo(() => String(collection?.name || 'Public Board'), [collection]);

  const load = useCallback(async (isRefresh = false) => {
    if (!collectionId) {
      setLoading(false);
      return;
    }
    try {
      const board = await api.getPublicBoard(collectionId);
      setCollection(board.collection || null);
      setItems(Array.isArray(board.items) ? (board.items as unknown as Post[]) : []);
    } catch {
      Alert.alert('Error', 'Could not load this public board.');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [collectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const renderItem = ({ item }: { item: Post }) => {
    const uri = postThumb(item);
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
        style={[styles.cell, { backgroundColor: colors.surfaceSecondary || '#111827' }]}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={styles.textCell}>
            <Text style={styles.textPreview} numberOfLines={5}>
              {item.text || 'Signal'}
            </Text>
          </View>
        )}
        {(item.media?.length || 0) > 1 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>▦</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {items.length} saved signals
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          numColumns={3}
          renderItem={renderItem}
          contentContainerStyle={styles.grid}
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>
                This public board is empty.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 44, alignItems: 'center' },
  title: { textAlign: 'center', fontSize: 18, fontWeight: '800' },
  subtitle: { textAlign: 'center', fontSize: 12, marginTop: 2 },
  grid: { paddingTop: GAP, paddingBottom: 30 },
  cell: { width: CELL, height: CELL, marginRight: GAP, marginBottom: GAP },
  thumb: { width: '100%', height: '100%' },
  textCell: { flex: 1, padding: 10, alignItems: 'center', justifyContent: 'center' },
  textPreview: { color: '#fff', fontSize: 12, textAlign: 'center', lineHeight: 16 },
  badge: { position: 'absolute', top: 6, right: 6 },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  empty: { width: Dimensions.get('window').width, padding: 40, alignItems: 'center' },
});
