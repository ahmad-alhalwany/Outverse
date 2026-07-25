import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldHero,
  WorldPrimaryButton,
  WorldStat,
} from '@/components/world/WorldChrome';

type ShopItemRow = {
  id: number | string;
  name: string;
  description?: string;
  price?: number;
  type?: string;
  type_display?: string;
  category?: string;
  category_display?: string;
  rating?: number;
  sales_count?: number;
  cover?: string;
  cover_url?: string;
};

export default function ShopScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<ShopItemRow[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      const [itemsPage, wallet] = await Promise.all([
        api.getShopItems({ ordering: 'trending' }),
        api.getShopWallet().catch(() => null),
      ]);
      setItems(itemsPage.results as ShopItemRow[]);
      if (wallet && typeof wallet.balance === 'number') {
        setBalance(wallet.balance);
      }
    } catch (error) {
      console.error('Failed to load shop:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePurchase = async (item: ShopItemRow) => {
    if (purchasingId) return;
    setPurchasingId(item.id);
    try {
      const result = await api.purchaseShopItem(item.id);
      Alert.alert('Purchased!', result?.message || `You bought "${item.name}".`);
      if (typeof result?.balance === 'number') {
        setBalance(result.balance);
      } else {
        load(true);
      }
    } catch (error: any) {
      Alert.alert('Purchase failed', error?.response?.data?.detail || 'Try again.');
    } finally {
      setPurchasingId(null);
    }
  };

  return (
    <WorldBackdrop tone="shop">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title="Shop"
          subtitle="Marketplace"
          tone="shop"
          onBack={() => navigation.goBack()}
        />

        {loading && items.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load(true);
                }}
                colors={[colors.primary]}
              />
            }
            ListHeaderComponent={
              <>
                <WorldHero
                  tone="shop"
                  eyebrow="Cosmory market"
                  title="Curated items for your journey"
                  body="Spend coins on boosts, flair, and creative tools."
                />
                {balance != null ? (
                  <WorldCard
                    style={styles.walletCard}
                    onPress={() => navigation.navigate('Wallet')}
                  >
                    <View style={styles.statsRow}>
                      <WorldStat label="Wallet" value={`${balance}`} />
                      <WorldStat label="Items" value={items.length} />
                    </View>
                    <Text style={[styles.topUpHint, { color: colors.primary }]}>
                      Tap to buy coins →
                    </Text>
                  </WorldCard>
                ) : null}
              </>
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🛍️</Text>
                <Text style={{ color: colors.textSecondary }}>No shop items yet</Text>
              </View>
            }
            renderItem={({ item }) => (
              <WorldCard>
                <View style={styles.cardTop}>
                  <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.price, { color: colors.primary }]}>{item.price ?? 0} coins</Text>
                </View>
                {item.description ? (
                  <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                <View style={styles.metaRow}>
                  {item.type_display || item.type ? (
                    <Text style={[styles.chip, { color: colors.textSecondary }]}>
                      {item.type_display || item.type}
                    </Text>
                  ) : null}
                  {item.rating != null ? (
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>★ {item.rating.toFixed(1)}</Text>
                  ) : null}
                  {item.sales_count != null ? (
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.sales_count} sold</Text>
                  ) : null}
                </View>
                <WorldPrimaryButton
                  label="Purchase"
                  onPress={() => handlePurchase(item)}
                  loading={purchasingId === item.id}
                  disabled={purchasingId === item.id}
                />
              </WorldCard>
            )}
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  walletCard: { marginBottom: 4 },
  statsRow: { flexDirection: 'row', gap: 8 },
  topUpHint: { marginTop: 10, fontSize: 13, fontWeight: '700' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  itemName: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  price: { fontSize: 15, fontWeight: '800' },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { fontSize: 12, fontWeight: '600' },
  meta: { fontSize: 12 },
});
