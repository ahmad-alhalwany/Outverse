import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
  asShopItems,
  asShopWallet,
  axiosBalance,
  purchaseErrorMessage,
  SHOP_CATEGORIES,
  SHOP_SORTS,
  SHOP_TYPES,
  shopCover,
  useShopPalette,
  type ShopItem,
} from '@/lib/shop';
import { ProductCard, shopBuyLabel } from './shopParts';

export default function ShopScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = useShopPalette(isDark);
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const cardGap = 12;
  const cardWidth = (width - 32 - cardGap) / 2;

  const [items, setItems] = useState<ShopItem[]>([]);
  const [featured, setFeatured] = useState<ShopItem[]>([]);
  const [ownedIds, setOwnedIds] = useState<Record<number, boolean>>({});
  const [ownedCollection, setOwnedCollection] = useState<ShopItem[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [category, setCategory] = useState('all');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('trending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
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

  const applyWallet = (data: unknown) => {
    const wallet = asShopWallet(data);
    setBalance(wallet.balance);
    const map: Record<number, boolean> = {};
    wallet.owned_item_ids.forEach((id) => {
      map[id] = true;
    });
    setOwnedIds(map);
    setOwnedCollection(wallet.owned_items);
  };

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const [itemsPage, featuredRows, wallet] = await Promise.all([
        api.getShopItems({
          ordering: sort,
          category: category === 'all' ? undefined : category,
          type: type === 'all' ? undefined : type,
        }),
        api.getShopFeatured().catch(() => []),
        api.getShopWallet().catch(() => null),
      ]);
      setItems(asShopItems(itemsPage.results ?? itemsPage));
      setFeatured(asShopItems(featuredRows));
      if (wallet) applyWallet(wallet);
    } catch {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, sort, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const filterBySearch = useCallback(
    (list: ShopItem[]) => {
      if (!q) return list;
      return list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description || '').toLowerCase().includes(q) ||
          (i.category_display || '').toLowerCase().includes(q),
      );
    },
    [q],
  );

  const shownItems = useMemo(() => filterBySearch(items), [items, filterBySearch]);
  const shownFeatured = useMemo(() => filterBySearch(featured), [featured, filterBySearch]);
  const banner = shownFeatured[0];

  const ownedItems = useMemo(() => {
    const byId = new Map<number, ShopItem>();
    ownedCollection.forEach((i) => byId.set(i.id, i));
    [...items, ...featured].forEach((i) => {
      if (!ownedIds[i.id]) return;
      const prev = byId.get(i.id);
      byId.set(i.id, prev ? { ...prev, ...i } : i);
    });
    return Array.from(byId.values());
  }, [items, featured, ownedIds, ownedCollection]);

  const openProduct = (item: ShopItem) => {
    navigation.navigate('ShopProduct', { productId: item.id });
  };

  const buy = async (item: ShopItem) => {
    if (ownedIds[item.id]) return;
    try {
      const data = await api.purchaseShopItem(item.id);
      setOwnedIds((o) => ({ ...o, [item.id]: true }));
      setOwnedCollection((list) => (list.some((i) => i.id === item.id) ? list : [item, ...list]));
      if (typeof data?.balance === 'number') setBalance(data.balance);
      setItems((list) =>
        list.map((i) => (i.id === item.id ? { ...i, sales_count: (i.sales_count || 0) + 1 } : i)),
      );
      setFeatured((list) =>
        list.map((i) => (i.id === item.id ? { ...i, sales_count: (i.sales_count || 0) + 1 } : i)),
      );
      showToast(t('shop.unlocked', { name: item.name }));
    } catch (err) {
      const nextBalance = axiosBalance(err);
      if (nextBalance != null) setBalance(nextBalance);
      showToast(purchaseErrorMessage(err, t, item.price) || t('shop.connectionError'));
    }
  };

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={`🛍️ ${t('shop.title')}`}
          subtitle={t('shop.subtitle')}
          tone="default"
          onBack={() => navigation.goBack()}
        />
        {loading && items.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.brown} />
            <Text style={[styles.hint, { color: C.text2 }]}>{t('shop.loadingProducts')}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />
            }
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.links}>
              <Pressable
                onPress={() => navigation.navigate('ShopSeller')}
                style={[styles.linkChip, { backgroundColor: C.white, borderColor: C.line }]}
              >
                <Ionicons name="bar-chart-outline" size={14} color={C.brownDk} />
                <Text style={[styles.linkText, { color: C.brownDk }]}>{t('shop.myShop')}</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('ShopOrders')}
                style={[styles.linkChip, { backgroundColor: C.white, borderColor: C.line }]}
              >
                <Ionicons name="download-outline" size={14} color={C.brownDk} />
                <Text style={[styles.linkText, { color: C.brownDk }]}>{t('shop.orderHistory')}</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('Wallet')}
                style={[styles.linkChip, { backgroundColor: C.card }]}
              >
                <Ionicons name="sparkles" size={14} color={C.brownDk} />
                <Text style={[styles.linkText, { color: C.brownDk }]}>
                  {balance != null ? balance.toLocaleString() : '…'} {t('common.coins')}
                </Text>
              </Pressable>
            </ScrollView>

            {ownedItems.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: C.brown }]}>
                  {t('shop.yourCollection')} ({ownedItems.length})
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                  {ownedItems.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => openProduct(item)}
                      style={[styles.ownedCard, { backgroundColor: C.white, borderColor: C.line }]}
                    >
                      {shopCover(item) ? (
                        <Image source={{ uri: shopCover(item) }} style={styles.ownedCover} />
                      ) : (
                        <View style={[styles.ownedCover, { backgroundColor: C.card }]} />
                      )}
                      <Text style={[styles.ownedName, { color: C.text }]} numberOfLines={2}>
                        {item.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={[styles.searchWrap, { backgroundColor: C.white, borderColor: C.line }]}>
              <Ionicons name="search" size={16} color={C.text2} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('shop.search')}
                placeholderTextColor={C.text2}
                style={[styles.search, { color: C.text }]}
              />
            </View>

            {banner ? (
              <Pressable
                onPress={() => openProduct(banner)}
                style={[styles.banner, { backgroundColor: C.card, borderColor: C.line }]}
              >
                {shopCover(banner) ? (
                  <Image source={{ uri: shopCover(banner) }} style={styles.bannerCover} />
                ) : (
                  <View style={[styles.bannerCover, { backgroundColor: C.card2 }]} />
                )}
                <View style={styles.bannerBody}>
                  <Text style={[styles.featuredLabel, { color: C.brown }]}>⭐ {t('shop.featuredWeek')}</Text>
                  <Text style={[styles.bannerTitle, { color: C.text }]}>{banner.name}</Text>
                  <Text style={[styles.bannerDesc, { color: C.text2 }]} numberOfLines={2}>
                    {banner.description}
                  </Text>
                  <View style={styles.bannerActions}>
                    <Pressable
                      onPress={() => void buy(banner)}
                      disabled={!!ownedIds[banner.id] || banner.stock === 0 || (balance != null && balance < banner.price)}
                      style={[styles.bannerBuy, { backgroundColor: C.brownDk }]}
                    >
                      <Text style={styles.bannerBuyText}>
                        {shopBuyLabel(t, {
                          owned: !!ownedIds[banner.id],
                          soldOut: banner.stock === 0,
                          canAfford: balance == null || balance >= banner.price,
                          price: banner.price,
                        })}
                      </Text>
                    </Pressable>
                    <Text style={[styles.tapDetails, { color: C.text2 }]}>{t('shop.tapDetails')}</Text>
                  </View>
                </View>
              </Pressable>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {SHOP_CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? C.brown : C.white,
                        borderColor: active ? C.brown : C.line,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? '#fff' : C.text2 }]}>{t(c.labelKey)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {SHOP_TYPES.map((typ) => {
                const active = type === typ.key;
                return (
                  <Pressable
                    key={typ.key}
                    onPress={() => setType(typ.key)}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: active ? C.card : 'transparent',
                        borderColor: active ? C.brown : C.line,
                      },
                    ]}
                  >
                    <Text style={[styles.typeText, { color: active ? C.brownDk : C.text2 }]}>{t(typ.labelKey)}</Text>
                  </Pressable>
                );
              })}
              {SHOP_SORTS.map((s) => {
                const active = sort === s.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => setSort(s.key)}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: active ? C.white : 'transparent',
                        borderColor: active ? C.brown : C.line,
                      },
                    ]}
                  >
                    <Text style={[styles.typeText, { color: active ? C.text : C.text2 }]}>{t(s.labelKey)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {error ? (
              <View style={[styles.empty, { backgroundColor: C.card2, borderColor: C.line }]}>
                <Text style={[styles.emptyTitle, { color: C.text }]}>{t('shop.loadError')}</Text>
                <Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: C.brownDk }]}>
                  <Text style={styles.retryText}>{t('common.tryAgain')}</Text>
                </Pressable>
              </View>
            ) : shownItems.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: C.card2, borderColor: C.line }]}>
                <Text style={[styles.hint, { color: C.text2 }]}>{q ? t('shop.noSearch') : t('shop.empty')}</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {shownItems.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    C={C}
                    width={cardWidth}
                    owned={!!ownedIds[item.id]}
                    canAfford={balance == null || balance >= item.price}
                    onOpen={() => openProduct(item)}
                    onBuy={() => void buy(item)}
                  />
                ))}
              </View>
            )}
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10 },
  hint: { fontSize: 13, textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  links: { gap: 8, paddingBottom: 12 },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  linkText: { fontSize: 13, fontWeight: '700' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 10 },
  rail: { gap: 10 },
  ownedCard: { width: 132, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
  ownedCover: { height: 72, width: '100%' },
  ownedName: { fontSize: 12, fontWeight: '700', padding: 8, minHeight: 44 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  search: { flex: 1, paddingVertical: 10, fontSize: 14 },
  banner: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, marginBottom: 16 },
  bannerCover: { height: 160, width: '100%' },
  bannerBody: { padding: 14 },
  featuredLabel: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  bannerTitle: { fontSize: 18, fontWeight: '800' },
  bannerDesc: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  bannerActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  bannerBuy: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  bannerBuyText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  tapDetails: { fontSize: 11, flex: 1 },
  chips: { gap: 8, paddingBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '700' },
  typeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  typeText: { fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 6 },
  empty: { borderRadius: 18, borderWidth: 1, padding: 28, alignItems: 'center', marginTop: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
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
