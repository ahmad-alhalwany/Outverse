import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  IDEA_KIND_ICONS,
  shopCover,
  shopCreatorName,
  type ShopItem,
  type ShopPalette,
} from '@/lib/shop';

type BuyLabelOpts = {
  owned: boolean;
  soldOut: boolean;
  canAfford: boolean;
  price?: number;
  compact?: boolean;
};

export function shopBuyLabel(
  t: (key: string, vars?: Record<string, string | number>) => string,
  opts: BuyLabelOpts,
) {
  if (opts.owned) return t('common.owned');
  if (opts.soldOut) return t('shop.soldOut');
  if (!opts.canAfford) return opts.compact ? t('common.needCoinsShort') : t('common.needCoins');
  if (opts.price != null && !opts.compact) return `${t('shop.getFor')} ${opts.price} ✨`;
  return t('common.get');
}

export function ShopTypeBadge({ item, C }: { item: ShopItem; C: ShopPalette }) {
  const ideaIcon = item.idea_kind ? IDEA_KIND_ICONS[item.idea_kind] : '';
  const label = ideaIcon
    ? `${ideaIcon} ${item.idea_kind_display || item.idea_kind}`
    : item.type_display || item.type;
  return (
    <View style={[styles.badge, { backgroundColor: C.badgeBg }]}>
      <Text style={[styles.badgeText, { color: C.brown }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function ProductCard({
  item,
  C,
  owned,
  canAfford,
  width,
  onOpen,
  onBuy,
}: {
  item: ShopItem;
  C: ShopPalette;
  owned: boolean;
  canAfford: boolean;
  width: number;
  onOpen: () => void;
  onBuy: () => void;
}) {
  const { t } = useLocale();
  const soldOut = item.stock === 0;
  const cover = shopCover(item);
  const locked = item.content_locked
    ? item.idea_kind === 'bottle' && item.unlock_at
      ? t('shop.contentLockedUntil', { date: new Date(item.unlock_at).toLocaleDateString() })
      : t('shop.contentLockedPurchase')
    : item.description;

  return (
    <View
      style={[
        styles.card,
        { width, backgroundColor: C.white, borderColor: C.line },
      ]}
    >
      <Pressable onPress={onOpen}>
        <View style={styles.coverWrap}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, { backgroundColor: C.card }]} />
          )}
          <View style={styles.badgeRow}>
            <ShopTypeBadge item={item} C={C} />
            {item.stock != null && item.stock > 0 && item.stock <= 5 ? (
              <View style={[styles.badge, { backgroundColor: C.badgeBg }]}>
                <Text style={[styles.badgeText, { color: C.stockHot }]}>
                  🔥 {t('shop.leftInStock', { count: item.stock })}
                </Text>
              </View>
            ) : null}
            {soldOut ? (
              <View style={[styles.badge, { backgroundColor: C.badgeBg }]}>
                <Text style={[styles.badgeText, { color: C.text2 }]}>{t('shop.soldOut')}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.body}>
          <View style={styles.meta}>
            <Ionicons name="star" size={12} color="#E0A83B" />
            <Text style={[styles.metaText, { color: C.text2 }]}>
              {(item.rating ?? 0).toFixed(1)} · {item.sales_count ?? 0} {t('common.sold')}
            </Text>
          </View>
          <Text style={[styles.name, { color: C.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.desc, { color: C.text2 }]} numberOfLines={2}>
            {locked}
          </Text>
          <Text style={[styles.by, { color: C.text2 }]} numberOfLines={1}>
            {t('common.by')} {shopCreatorName(item.creator)}
          </Text>
          <Text style={[styles.price, { color: C.brownDk }]}>✨ {item.price}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onBuy}
        disabled={owned || !canAfford || soldOut}
        style={[
          styles.buy,
          {
            backgroundColor: owned
              ? C.successText
              : !canAfford || soldOut
                ? C.card2
                : C.brownDk,
          },
        ]}
      >
        <Text
          style={[
            styles.buyText,
            { color: owned || (canAfford && !soldOut) ? '#fff' : C.text2 },
          ]}
        >
          {shopBuyLabel(t, { owned, soldOut, canAfford, compact: true })}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  coverWrap: { position: 'relative' },
  cover: { height: 120, width: '100%' },
  badgeRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, maxWidth: '70%' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  body: { padding: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11 },
  name: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  desc: { fontSize: 12, lineHeight: 16, marginTop: 2, minHeight: 32 },
  by: { fontSize: 11, marginTop: 6 },
  price: { fontSize: 14, fontWeight: '800', marginTop: 6 },
  buy: {
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  buyText: { fontSize: 12, fontWeight: '800' },
});
