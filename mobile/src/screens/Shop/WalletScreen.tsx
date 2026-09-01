import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import { openInAppWeb } from '@/lib/nav';
import {
  asCoinPacks,
  asShopWallet,
  formatUsdCents,
  useShopPalette,
  type CoinPack,
} from '@/lib/shop';

type CheckoutBanner = 'success' | null;

export default function WalletScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = useShopPalette(isDark);
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const packWidth = (width - 32 - 12) / 2;

  const [balance, setBalance] = useState<number | null>(null);
  const [packs, setPacks] = useState<CoinPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [busyPack, setBusyPack] = useState<number | null>(null);
  const [banner, setBanner] = useState<CheckoutBanner>(null);
  const checkoutBalanceRef = useRef<number | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(false);
    try {
      const [wallet, coinPacks] = await Promise.all([
        api.getShopWallet().catch(() => null),
        api.getCoinPacks(),
      ]);
      const nextBalance = wallet ? asShopWallet(wallet).balance : null;
      if (nextBalance != null) {
        if (
          checkoutBalanceRef.current != null &&
          nextBalance > checkoutBalanceRef.current
        ) {
          setBanner('success');
        }
        setBalance(nextBalance);
      }
      setPacks(asCoinPacks(coinPacks));
    } catch {
      setPacks([]);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleBuy = async (pack: CoinPack) => {
    if (busyPack) return;
    setBusyPack(pack.id);
    setCheckoutError('');
    setBanner(null);
    checkoutBalanceRef.current = balance;
    try {
      const result = await api.createCoinCheckout(pack.id);
      if (!result?.checkout_url) {
        setCheckoutError(t('wallet.checkoutError'));
        return;
      }
      openInAppWeb(navigation, pack.name || t('nav.wallet'), result.checkout_url);
    } catch (error) {
      const data = (error as { response?: { data?: { error?: string; detail?: string } } })?.response?.data;
      setCheckoutError(data?.error || data?.detail || t('wallet.checkoutError'));
    } finally {
      setBusyPack(null);
    }
  };

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('nav.wallet')}
          subtitle={t('wallet.title')}
          tone="default"
          onBack={() => navigation.goBack()}
          right={
            <Pressable onPress={() => navigation.navigate('Shop')}>
              <Text style={{ color: C.brown, fontWeight: '800', fontSize: 13 }}>{t('nav.shop')}</Text>
            </Pressable>
          }
        />

        {loading && packs.length === 0 && balance == null ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.brown} />
            <Text style={[styles.hint, { color: C.text2 }]}>{t('common.loading')}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />
            }
          >
            <View style={[styles.balanceCard, { backgroundColor: C.card, borderColor: C.line }]}>
              <Text style={[styles.balanceLabel, { color: C.text2 }]}>{t('wallet.balance')}</Text>
              <View style={styles.balanceRow}>
                <Ionicons name="sparkles" size={26} color={C.brown} />
                <Text style={[styles.balanceValue, { color: C.text }]}>
                  {balance != null ? balance.toLocaleString() : '—'}
                </Text>
              </View>
            </View>

            {banner === 'success' ? (
              <View style={[styles.banner, { backgroundColor: C.successBg }]}>
                <Text style={[styles.bannerText, { color: C.successText }]}>{t('wallet.checkoutSuccess')}</Text>
              </View>
            ) : null}
            {checkoutError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{checkoutError}</Text>
              </View>
            ) : null}

            <Text style={[styles.sectionTitle, { color: C.text }]}>{t('wallet.title')}</Text>

            {loadError ? (
              <View style={[styles.empty, { backgroundColor: C.card2, borderColor: C.line }]}>
                <Text style={[styles.emptyTitle, { color: C.text }]}>{t('wallet.loadError')}</Text>
                <Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: C.brownDk }]}>
                  <Text style={styles.retryText}>{t('common.tryAgain')}</Text>
                </Pressable>
              </View>
            ) : packs.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: C.card2, borderColor: C.line }]}>
                <Text style={[styles.hint, { color: C.text2 }]}>{t('wallet.empty')}</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {packs.map((pack) => {
                  const busy = busyPack === pack.id;
                  return (
                    <View
                      key={pack.id}
                      style={[styles.pack, { width: packWidth, backgroundColor: C.white, borderColor: C.line }]}
                    >
                      <Text style={[styles.packName, { color: C.text }]} numberOfLines={2}>
                        {pack.name}
                      </Text>
                      <View style={styles.coinsRow}>
                        <Text style={[styles.coins, { color: C.text }]}>{pack.coins.toLocaleString()}</Text>
                        <Ionicons name="sparkles" size={18} color={C.brown} />
                      </View>
                      <Pressable
                        onPress={() => void handleBuy(pack)}
                        disabled={busy}
                        style={[
                          styles.buy,
                          { backgroundColor: C.brownDk, opacity: busy ? 0.6 : 1 },
                        ]}
                      >
                        <Text style={styles.buyText}>
                          {busy ? t('common.loading') : formatUsdCents(pack.price_usd_cents)}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
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
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  balanceCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  balanceLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceValue: { fontSize: 32, fontWeight: '800' },
  banner: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  bannerText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  errorBanner: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  errorText: { fontSize: 13, fontWeight: '700', color: '#f87171', textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  pack: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  packName: { fontSize: 14, fontWeight: '700', textAlign: 'center', minHeight: 36 },
  coinsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 10 },
  coins: { fontSize: 22, fontWeight: '800' },
  buy: {
    alignSelf: 'stretch',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  buyText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  empty: { borderRadius: 18, borderWidth: 1, padding: 28, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  retry: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '800' },
});
