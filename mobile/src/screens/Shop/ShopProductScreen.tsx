import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import {
  asShopWallet,
  axiosBalance,
  IDEA_KIND_ICONS,
  purchaseErrorMessage,
  shopAccessUrl,
  shopCover,
  shopCreatorName,
  useShopPalette,
  type ShopItem,
} from '@/lib/shop';

export default function ShopProductScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDark } = useTheme();
  const C = useShopPalette(isDark);
  const { t } = useLocale();
  const productId = Number(route.params?.productId || route.params?.id || route.params?.product || 0);

  const [item, setItem] = useState<ShopItem | null>(null);
  const [owned, setOwned] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [shipping, setShipping] = useState('');
  const [buying, setBuying] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  };

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const load = useCallback(async () => {
    if (!productId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const [product, wallet] = await Promise.all([
        api.getShopItem(productId),
        api.getShopWallet().catch(() => null),
      ]);
      setItem(product as ShopItem);
      if (wallet) {
        const w = asShopWallet(wallet);
        setBalance(w.balance);
        setOwned(w.owned_item_ids.includes(productId));
      }
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setNotFound(status === 404);
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const buy = async () => {
    if (!item || owned || buying) return;
    setBuying(true);
    try {
      const data = await api.purchaseShopItem(item.id, item.type === 'physical' ? shipping.trim() : undefined);
      setOwned(true);
      if (typeof data?.balance === 'number') setBalance(data.balance);
      showToast(t('shop.unlocked', { name: item.name }));
    } catch (err) {
      const nextBalance = axiosBalance(err);
      if (nextBalance != null) setBalance(nextBalance);
      showToast(purchaseErrorMessage(err, t, item.price) || t('shop.connectionError'));
    } finally {
      setBuying(false);
    }
  };

  const soldOut = item?.stock === 0;
  const canAfford = !item || balance == null || balance >= item.price;
  const isPhysical = item?.type === 'physical';
  const shippingMissing = Boolean(isPhysical && !owned && !shipping.trim());
  const cover = item ? shopCover(item) : '';
  const accessUrl = item && owned && item.type !== 'physical' ? shopAccessUrl(item) : '';
  const description = item?.content_locked
    ? item.idea_kind === 'bottle' && item.unlock_at
      ? t('shop.contentLockedUntil', { date: new Date(item.unlock_at).toLocaleString() })
      : t('shop.contentLockedPurchase')
    : item?.description;

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={item?.name || t('shop.title')}
          subtitle={t('shop.backToShop')}
          tone="default"
          onBack={() => navigation.goBack()}
        />
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.brown} />
            <Text style={[styles.hint, { color: C.text2 }]}>{t('common.loading')}</Text>
          </View>
        ) : notFound || !item ? (
          <View style={styles.center}>
            <Text style={[styles.hint, { color: C.text2 }]}>{t('shop.productNotFound')}</Text>
            <Pressable onPress={() => navigation.navigate('Shop')} style={[styles.retry, { backgroundColor: C.brownDk }]}>
              <Text style={styles.retryText}>{t('shop.backToShop')}</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}>
              {cover ? (
                <Image source={{ uri: cover }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, { backgroundColor: C.card }]} />
              )}
              <View style={styles.body}>
                <View style={styles.chips}>
                  {item.category_display ? (
                    <View style={[styles.chip, { backgroundColor: C.card2 }]}>
                      <Text style={[styles.chipText, { color: C.brown }]}>{item.category_display}</Text>
                    </View>
                  ) : null}
                  <View style={[styles.chip, { backgroundColor: C.cream, borderColor: C.line, borderWidth: 1 }]}>
                    <Text style={[styles.chipText, { color: C.text2 }]}>
                      {item.idea_kind
                        ? `${IDEA_KIND_ICONS[item.idea_kind] || ''} ${item.idea_kind_display || item.idea_kind}`
                        : item.type_display}
                    </Text>
                  </View>
                  {item.is_featured ? (
                    <View style={[styles.chip, { backgroundColor: C.brown }]}>
                      <Text style={[styles.chipText, { color: '#fff' }]}>{t('shop.featured')}</Text>
                    </View>
                  ) : null}
                  {item.stock != null && item.stock > 0 ? (
                    <View style={[styles.chip, { backgroundColor: item.stock <= 5 ? C.card2 : C.cream }]}>
                      <Text style={[styles.chipText, { color: item.stock <= 5 ? C.stockHot : C.text2 }]}>
                        {item.stock <= 5 ? '🔥 ' : ''}
                        {t('shop.leftInStock', { count: item.stock })}
                      </Text>
                    </View>
                  ) : null}
                  {soldOut ? (
                    <View style={[styles.chip, { backgroundColor: C.card2 }]}>
                      <Text style={[styles.chipText, { color: C.text2 }]}>{t('shop.soldOut')}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={[styles.title, { color: C.text }]}>{item.name}</Text>
                <Text style={[styles.desc, { color: C.text2 }]}>{description}</Text>

                <View style={styles.meta}>
                  <Ionicons name="star" size={14} color="#E0A83B" />
                  <Text style={[styles.metaText, { color: C.text2 }]}>
                    {(item.rating ?? 0).toFixed(1)} · {item.sales_count ?? 0} {t('common.sold')} · {t('common.by')}{' '}
                    {shopCreatorName(item.creator)}
                  </Text>
                </View>

                <View style={[styles.priceBox, { backgroundColor: C.card2, borderColor: C.line }]}>
                  <View>
                    <Text style={[styles.priceLabel, { color: C.text2 }]}>{t('shop.price')}</Text>
                    <Text style={[styles.price, { color: C.brownDk }]}>
                      ✨ {item.price} {t('common.coins')}
                    </Text>
                  </View>
                  {balance != null ? (
                    <Text style={[styles.balance, { color: C.text2 }]}>
                      {t('shop.yourBalance')}: {balance.toLocaleString()}
                    </Text>
                  ) : null}
                </View>

                {isPhysical && !owned ? (
                  <View style={styles.shipping}>
                    <Text style={[styles.priceLabel, { color: C.text2 }]}>{t('shop.shippingAddress')}</Text>
                    <TextInput
                      value={shipping}
                      onChangeText={setShipping}
                      multiline
                      placeholder={t('shop.shippingAddress')}
                      placeholderTextColor={C.text2}
                      style={[styles.shippingInput, { backgroundColor: C.white, borderColor: C.line, color: C.text }]}
                    />
                  </View>
                ) : null}

                <Pressable
                  onPress={() => void buy()}
                  disabled={owned || !canAfford || shippingMissing || soldOut || buying}
                  style={[styles.buy, { backgroundColor: C.brownDk, opacity: owned || !canAfford || shippingMissing || soldOut || buying ? 0.7 : 1 }]}
                >
                  <Text style={styles.buyText}>
                    {owned
                      ? t('common.owned')
                      : soldOut
                        ? t('shop.soldOut')
                        : !canAfford
                          ? t('shop.notEnoughCoins')
                          : shippingMissing
                            ? t('shop.shippingAddressRequired')
                            : `${t('shop.unlockFor')} ${item.price} ✨`}
                  </Text>
                </Pressable>

                {accessUrl ? (
                  <Pressable
                    onPress={() => void Linking.openURL(accessUrl)}
                    style={[styles.access, { backgroundColor: C.card2, borderColor: C.line }]}
                  >
                    <Ionicons name="download-outline" size={16} color={C.brownDk} />
                    <Text style={[styles.accessText, { color: C.brownDk }]}>{t('shop.downloadAccess')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </ScrollView>
        )}

        {toast ? (
          <View style={[styles.toast, { backgroundColor: C.brownDk }]}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  hint: { fontSize: 14, textAlign: 'center' },
  content: { padding: 16, paddingBottom: 48 },
  card: { borderRadius: 18, overflow: 'hidden', borderWidth: 1 },
  cover: { height: 220, width: '100%' },
  body: { padding: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800', marginTop: 12 },
  desc: { fontSize: 14, lineHeight: 21, marginTop: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  metaText: { fontSize: 13, flex: 1 },
  priceBox: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  priceLabel: { fontSize: 12, fontWeight: '700' },
  price: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  balance: { fontSize: 12 },
  shipping: { marginTop: 14 },
  shippingInput: {
    marginTop: 8,
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    textAlignVertical: 'top',
  },
  buy: { marginTop: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buyText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  access: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 13,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  accessText: { fontWeight: '800' },
  retry: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '800' },
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 28,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
});
