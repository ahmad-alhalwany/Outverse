import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
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
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import {
  asShopTransactions,
  shopAccessUrl,
  shopCover,
  useShopPalette,
  type ShopTransaction,
} from '@/lib/shop';

function txStatusKey(status?: string) {
  if (status === 'completed') return 'shop.txStatusCompleted';
  if (status === 'failed') return 'shop.txStatusFailed';
  return 'shop.txStatusPending';
}

export default function ShopOrdersScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = useShopPalette(isDark);
  const { t } = useLocale();
  const [rows, setRows] = useState<ShopTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      setRows(asShopTransactions(await api.getShopTransactions()));
    } catch {
      setRows([]);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const completedCount = useMemo(
    () => rows.filter((tx) => tx.status === 'completed').length,
    [rows],
  );

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('shop.orderHistory')}
          subtitle={t('shop.orderHistorySubtitle')}
          tone="default"
          onBack={() => navigation.goBack()}
        />
        {loading && rows.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.brown} />
            <Text style={[styles.hint, { color: C.text2 }]}>{t('shop.loadingOrders')}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />
            }
          >
            <View style={[styles.count, { backgroundColor: C.card }]}>
              <Text style={[styles.countText, { color: C.brownDk }]}>
                {completedCount} {t('shop.completedOrders')}
              </Text>
            </View>

            {error ? (
              <View style={[styles.empty, { backgroundColor: C.card2, borderColor: C.line }]}>
                <Text style={[styles.emptyTitle, { color: C.text }]}>{t('shop.ordersLoadError')}</Text>
                <Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: C.brownDk }]}>
                  <Text style={styles.retryText}>{t('common.tryAgain')}</Text>
                </Pressable>
              </View>
            ) : rows.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: C.card2, borderColor: C.line }]}>
                <Text style={[styles.hint, { color: C.text2 }]}>{t('shop.noOrders')}</Text>
              </View>
            ) : (
              rows.map((tx) => {
                const item = tx.item;
                const cover = item ? shopCover(item) : '';
                const accessUrl = item?.type === 'digital' && item ? shopAccessUrl(item) : '';
                const when = tx.timestamp || tx.created_at;
                return (
                  <Pressable
                    key={tx.id}
                    onPress={() => item?.id && navigation.navigate('ShopProduct', { productId: item.id })}
                    style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}
                  >
                    {cover ? (
                      <Image source={{ uri: cover }} style={styles.cover} />
                    ) : (
                      <View style={[styles.cover, { backgroundColor: C.card }]} />
                    )}
                    <View style={styles.body}>
                      <Text style={[styles.title, { color: C.text }]} numberOfLines={2}>
                        {item?.name || t('shop.title')}
                      </Text>
                      <View style={styles.chips}>
                        {item?.type_display ? (
                          <View style={[styles.chip, { backgroundColor: C.card2 }]}>
                            <Text style={[styles.chipText, { color: C.brown }]}>{item.type_display}</Text>
                          </View>
                        ) : null}
                        <View style={[styles.chip, { backgroundColor: C.successBg }]}>
                          <Text style={[styles.chipText, { color: C.successText }]}>{t(txStatusKey(tx.status))}</Text>
                        </View>
                        {item?.type === 'physical' && tx.fulfillment_status && tx.fulfillment_status !== 'not_applicable' ? (
                          <View style={[styles.chip, { backgroundColor: C.card2 }]}>
                            <Text style={[styles.chipText, { color: C.brownDk }]}>
                              {tx.fulfillment_status_display || tx.fulfillment_status}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {when ? (
                        <Text style={[styles.when, { color: C.text2 }]}>
                          {new Date(when).toLocaleString()}
                        </Text>
                      ) : null}
                      <Text style={[styles.amount, { color: C.brownDk }]}>
                        {t('shop.pricePaid')}: {tx.amount} ✨
                      </Text>
                      {accessUrl ? (
                        <Pressable
                          onPress={() => void Linking.openURL(accessUrl)}
                          style={[styles.download, { backgroundColor: C.card2, borderColor: C.line }]}
                        >
                          <Ionicons name="download-outline" size={14} color={C.brownDk} />
                          <Text style={[styles.downloadText, { color: C.brownDk }]}>{t('shop.downloadAccess')}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10 },
  hint: { fontSize: 13, textAlign: 'center' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  count: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  countText: { fontSize: 13, fontWeight: '800' },
  empty: { borderRadius: 18, borderWidth: 1, padding: 28, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  retry: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden', flexDirection: 'row' },
  cover: { width: 88, height: 88 },
  body: { flex: 1, padding: 12 },
  title: { fontSize: 15, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '700' },
  when: { fontSize: 11, marginTop: 8 },
  amount: { fontSize: 13, fontWeight: '800', marginTop: 6 },
  download: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  downloadText: { fontSize: 12, fontWeight: '800' },
});
