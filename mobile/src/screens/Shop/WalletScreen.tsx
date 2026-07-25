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
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldPrimaryButton,
  WorldStat,
} from '@/components/world/WorldChrome';

type CoinPack = {
  id: number | string;
  name: string;
  coins: number;
  price_usd_cents: number;
  stripe_price_id?: string;
  is_active?: boolean;
  sort_order?: number;
};

export default function WalletScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [balance, setBalance] = useState<number | null>(null);
  const [packs, setPacks] = useState<CoinPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buyingId, setBuyingId] = useState<string | number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      const [wallet, coinPacks] = await Promise.all([
        api.getShopWallet().catch(() => null),
        api.getCoinPacks().catch(() => []),
      ]);
      if (wallet && typeof wallet.balance === 'number') {
        setBalance(wallet.balance);
      }
      setPacks((coinPacks as CoinPack[]).filter((p) => p.is_active !== false));
    } catch (error) {
      console.error('Failed to load wallet:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleBuy = async (pack: CoinPack) => {
    if (buyingId) return;
    setBuyingId(pack.id);
    try {
      const result = await api.createCoinCheckout(pack.id);
      if (result?.checkout_url) {
        await Linking.openURL(result.checkout_url);
      } else {
        Alert.alert('Unavailable', 'Stripe checkout is not configured yet.');
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        'Could not start checkout. Try again.';
      Alert.alert('Purchase failed', message);
    } finally {
      setBuyingId(null);
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <WorldBackdrop tone="shop">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title="Coin Wallet"
          subtitle="Top up your balance"
          tone="shop"
          onBack={() => navigation.goBack()}
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={packs}
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
              <WorldCard style={styles.balanceCard}>
                <View style={styles.statsRow}>
                  <WorldStat label="Balance" value={balance != null ? `${balance} ✨` : '—'} />
                </View>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>
                  Spend coins in the shop to unlock items, boosts, and flair.
                </Text>
              </WorldCard>
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>✨</Text>
                <Text style={{ color: colors.textSecondary }}>No coin packs available yet</Text>
              </View>
            }
            renderItem={({ item }) => (
              <WorldCard>
                <View style={styles.packHeader}>
                  <Text style={[styles.packName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.packPrice, { color: colors.primary }]}>
                    {formatPrice(item.price_usd_cents)}
                  </Text>
                </View>
                <View style={styles.statsRow}>
                  <WorldStat label="Coins" value={`${item.coins} ✨`} />
                  <WorldStat
                    label="Value"
                    value={`${(item.coins / (item.price_usd_cents / 100)).toFixed(0)} coins/$`}
                  />
                </View>
                <WorldPrimaryButton
                  label={buyingId === item.id ? 'Opening…' : `Buy for ${formatPrice(item.price_usd_cents)}`}
                  onPress={() => handleBuy(item)}
                  loading={buyingId === item.id}
                  disabled={!!buyingId}
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
  balanceCard: { marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  hint: { fontSize: 13, lineHeight: 18 },
  packHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  packName: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  packPrice: { fontSize: 17, fontWeight: '800' },
});
