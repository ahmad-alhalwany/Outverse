import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  asSellerSales,
  useShopPalette,
  type SellerSales,
  type ShopItem,
} from '@/lib/shop';

export default function ShopSellerScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = useShopPalette(isDark);
  const { t, locale, isRTL } = useLocale();

  const [data, setData] = useState<SellerSales | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShopItem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState('digital');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      setData(asSellerSales(await api.getMySales()));
    } catch {
      setData(null);
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

  const openForm = (item?: ShopItem) => {
    setEditing(item || null);
    setName(item?.name || '');
    setDescription(item?.description || '');
    setPrice(item ? String(item.price) : '');
    setType(item?.type || 'digital');
    setFormOpen(true);
  };

  const saveProduct = async () => {
    if (!name.trim() || !description.trim() || !price.trim()) {
      Alert.alert(t('creatorDashboard.title'), t('creatorDashboard.requiredFields'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        type,
      };
      if (editing) await api.updateShopItem(editing.id, payload);
      else await api.createShopItem(payload);
      setFormOpen(false);
      await load(true);
    } catch {
      Alert.alert(t('creatorDashboard.title'), t('creatorDashboard.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = (id: number) => {
    Alert.alert(t('creatorDashboard.deleteProduct'), t('creatorDashboard.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('creatorDashboard.deleteProduct'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          try {
            await api.deleteShopItem(id);
            await load(true);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const markShipped = async (id: number) => {
    setBusyId(id);
    try {
      await api.fulfillShopOrder(id);
      await load(true);
    } finally {
      setBusyId(null);
    }
  };

  const maxRevenue = Math.max(1, ...(data?.sales_by_day || []).map((row) => row.revenue));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.cream }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />}
      >
        <Pressable onPress={() => navigation.navigate('Shop')} style={styles.back} hitSlop={10}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={16} color={C.text2} />
          <Text style={[styles.backText, { color: C.text2 }]}>{t('shop.backToShop')}</Text>
        </Pressable>

        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: C.brown }]}>{t('creatorDashboard.title')}</Text>
          <Pressable onPress={() => openForm()} style={[styles.addBtn, { backgroundColor: C.brownDk }]}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.addText}>{t('creatorDashboard.addProduct')}</Text>
          </Pressable>
        </View>
        <Text style={[styles.subtitle, { color: C.text2 }]}>
          {t('creatorDashboard.subtitle')}{' '}
          <Text style={{ color: C.brown, textDecorationLine: 'underline' }} onPress={() => navigation.navigate('Analytics')}>
            {t('creatorDashboard.viewFullAnalytics')}
          </Text>
        </Text>

        {loading && !data ? (
          <Text style={[styles.emptyText, { color: C.text2 }]}>{t('common.loading')}</Text>
        ) : !data ? (
          <View style={[styles.empty, { backgroundColor: C.card2 }]}>
            <Text style={[styles.emptyText, { color: C.text2 }]}>{t('creatorDashboard.noProducts')}</Text>
            <Pressable onPress={() => navigation.navigate('Shop')} style={{ marginTop: 12 }}>
              <Text style={{ color: C.brown, fontWeight: '700' }}>{t('shop.backToShop')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.kpis}>
              {[
                { label: t('creatorDashboard.revenue'), value: `${data.revenue} ✨` },
                { label: t('creatorDashboard.orders'), value: data.orders_count },
                { label: t('creatorDashboard.activeProducts'), value: data.active_products },
                { label: t('creatorDashboard.pendingFulfillment'), value: data.pending_fulfillment },
              ].map((kpi) => (
                <View key={kpi.label} style={[styles.kpi, { backgroundColor: C.white, borderColor: C.line }]}>
                  <Text style={[styles.kpiValue, { color: C.brown }]}>{kpi.value}</Text>
                  <Text style={[styles.kpiLabel, { color: C.text2 }]}>{kpi.label}</Text>
                </View>
              ))}
            </View>

            {data.sales_by_day.length > 0 ? (
              <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
                <Text style={[styles.sectionTitle, { color: C.text }]}>{t('creatorDashboard.salesLast28Days')}</Text>
                <View style={styles.bars}>
                  {data.sales_by_day.map((row) => (
                    <View key={row.day} style={styles.barCol}>
                      <View
                        style={[
                          styles.bar,
                          { height: Math.max(4, (row.revenue / maxRevenue) * 80), backgroundColor: C.brown },
                        ]}
                      />
                      <Text style={[styles.barLabel, { color: C.text2 }]}>{row.day.slice(5)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <Text style={[styles.sectionTitle, { color: C.text }]}>{t('creatorDashboard.yourProducts')}</Text>
            {data.items.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: C.card2 }]}>
                <Text style={[styles.emptyText, { color: C.text2 }]}>{t('creatorDashboard.noProducts')}</Text>
              </View>
            ) : (
              data.items.map((item) => (
                <View key={item.id} style={[styles.row, { backgroundColor: C.white, borderColor: C.line }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.rowTitle, { color: C.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.rowMeta, { color: C.text2 }]}>
                      {item.price} ✨ · {item.sales_count} {t('creatorDashboard.sold')}
                      {item.stock != null ? ` · ${t('shop.leftInStock', { count: item.stock })}` : ''}
                    </Text>
                  </View>
                  <View style={styles.rowActions}>
                    <Text
                      style={[
                        styles.badge,
                        {
                          backgroundColor: item.is_available ? C.successBg : C.card2,
                          color: item.is_available ? C.successText : C.text2,
                        },
                      ]}
                    >
                      {item.is_available ? t('creatorDashboard.visible') : t('creatorDashboard.hidden')}
                    </Text>
                    <Pressable onPress={() => openForm(item)} style={[styles.smallBtn, { backgroundColor: C.card2 }]}>
                      <Text style={[styles.smallBtnText, { color: C.brownDk }]}>{t('creatorDashboard.edit')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => deleteItem(item.id)}
                      disabled={busyId === item.id}
                      style={[styles.smallBtn, { backgroundColor: C.card2 }]}
                    >
                      <Text style={[styles.smallBtnText, { color: '#c0392b' }]}>{t('creatorDashboard.deleteProduct')}</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}

            <Text style={[styles.sectionTitle, { color: C.text, marginTop: 18 }]}>{t('creatorDashboard.orders')}</Text>
            {data.orders.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: C.card2 }]}>
                <Text style={[styles.emptyText, { color: C.text2 }]}>{t('creatorDashboard.noOrders')}</Text>
              </View>
            ) : (
              data.orders.map((order) => (
                <View key={order.id} style={[styles.row, { backgroundColor: C.white, borderColor: C.line }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.rowTitle, { color: C.text }]} numberOfLines={1}>{order.item?.name}</Text>
                    <Text style={[styles.rowMeta, { color: C.text2 }]}>
                      @{order.buyer_username || '—'} · {order.amount} ✨ ·{' '}
                      {new Date(order.timestamp || order.created_at || '').toLocaleDateString(locale === 'ar' ? 'ar' : undefined)}
                    </Text>
                  </View>
                  {order.item?.type === 'physical' && order.fulfillment_status !== 'not_applicable' ? (
                    <View style={styles.rowActions}>
                      <Text style={[styles.badge, { backgroundColor: C.card2, color: C.brownDk }]}>
                        {order.fulfillment_status_display || order.fulfillment_status}
                      </Text>
                      {order.fulfillment_status === 'pending' ? (
                        <Pressable
                          onPress={() => void markShipped(order.id)}
                          disabled={busyId === order.id}
                          style={[styles.smallBtn, { backgroundColor: C.brownDk }]}
                        >
                          <Text style={[styles.smallBtnText, { color: '#fff' }]}>
                            {busyId === order.id ? t('creatorDashboard.updating') : t('creatorDashboard.markShipped')}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={[styles.badge, { backgroundColor: C.successBg, color: C.successText }]}>
                      {order.status === 'completed'
                        ? t('shop.txStatusCompleted')
                        : order.status === 'failed'
                          ? t('shop.txStatusFailed')
                          : t('shop.txStatusPending')}
                    </Text>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {formOpen ? (
          <View style={[styles.form, { backgroundColor: C.white, borderColor: C.line }]}>
            <Text style={[styles.sectionTitle, { color: C.text }]}>
              {editing ? t('creatorDashboard.editProduct') : t('creatorDashboard.addProduct')}
            </Text>
            <Text style={[styles.field, { color: C.text2 }]}>{t('creatorDashboard.fieldName')}</Text>
            <TextInput value={name} onChangeText={setName} style={[styles.input, { color: C.text, borderColor: C.line, backgroundColor: C.card2 }]} />
            <Text style={[styles.field, { color: C.text2 }]}>{t('creatorDashboard.fieldDescription')}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              style={[styles.input, styles.area, { color: C.text, borderColor: C.line, backgroundColor: C.card2 }]}
            />
            <Text style={[styles.field, { color: C.text2 }]}>{t('creatorDashboard.fieldPrice')}</Text>
            <TextInput
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              style={[styles.input, { color: C.text, borderColor: C.line, backgroundColor: C.card2 }]}
            />
            <View style={styles.types}>
              {(['digital', 'physical', 'idea'] as const).map((id) => (
                <Pressable
                  key={id}
                  onPress={() => setType(id)}
                  style={[styles.typeChip, { backgroundColor: type === id ? C.brownDk : C.card2 }]}
                >
                  <Text style={{ color: type === id ? '#fff' : C.brownDk, fontWeight: '700', fontSize: 12 }}>
                    {t(`shop.${id}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.formActions}>
              <Pressable onPress={() => setFormOpen(false)}>
                <Text style={{ color: C.text2, fontWeight: '700' }}>{t('creatorDashboard.cancel')}</Text>
              </Pressable>
              <Pressable onPress={() => void saveProduct()} disabled={saving} style={[styles.addBtn, { backgroundColor: C.brownDk }]}>
                <Text style={styles.addText}>{saving ? t('creatorDashboard.saving') : t('creatorDashboard.save')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  backText: { fontSize: 14, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 26, fontWeight: '800', flex: 1 },
  addBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 18 },
  empty: { borderRadius: 18, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  kpi: { flexGrow: 1, flexBasis: 148, minWidth: 148, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center' },
  kpiValue: { fontSize: 18, fontWeight: '800' },
  kpiLabel: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  panel: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 2 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '80%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barLabel: { fontSize: 8 },
  row: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 8 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowMeta: { fontSize: 12, marginTop: 4 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  smallBtn: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  smallBtnText: { fontSize: 11, fontWeight: '700' },
  form: { borderRadius: 18, borderWidth: 1, padding: 16, marginTop: 16 },
  field: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  area: { minHeight: 80, textAlignVertical: 'top' },
  types: { flexDirection: 'row', gap: 8, marginTop: 12 },
  typeChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  formActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
});
