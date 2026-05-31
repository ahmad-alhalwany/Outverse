'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import WorldShell from '@/components/world/WorldShell';
import { AnimatePresence, motion } from 'framer-motion';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { shopCreatorName, type ShopItem } from '@/lib/shopTypes';
import {
  MagnifyingGlassIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';

import { apiUrl } from '@/lib/api';

const BASE = apiUrl('shop/items');

const PALETTES = {
  light: {
    cream: '#FBF3EE',
    card: '#F5E4DB',
    card2: '#F9ECE4',
    white: '#FFFFFF',
    brown: '#A0563B',
    brownDk: '#854330',
    text: '#3D2B22',
    text2: '#9A8278',
    line: 'rgba(160,86,59,0.14)',
    headerBg: 'rgba(251,243,238,0.85)',
    shadowSm: '0 2px 12px rgba(160,86,59,0.06)',
    btnShadow: '0 6px 18px rgba(160,86,59,0.3)',
    heroShadow: '0 8px 24px rgba(61,43,34,0.3)',
    badgeBg: 'rgba(255,255,255,0.92)',
    overlay: 'rgba(61,43,34,0.45)',
  },
  dark: {
    cream: '#1a1a2e',
    card: '#23234a',
    card2: '#2d1b4a',
    white: '#2a2a45',
    brown: '#c49a6c',
    brownDk: '#a0563b',
    text: '#F5F6FA',
    text2: '#B3B3B3',
    line: 'rgba(106,0,255,0.18)',
    headerBg: 'rgba(26,26,46,0.9)',
    shadowSm: '0 2px 12px rgba(106,0,255,0.12)',
    btnShadow: '0 6px 20px rgba(106,0,255,0.25)',
    heroShadow: '0 8px 24px rgba(106,0,255,0.2)',
    badgeBg: 'rgba(42,42,69,0.92)',
    overlay: 'rgba(10,10,34,0.65)',
  },
};

function useShopColors() {
  const { theme } = useTheme();
  return PALETTES[theme];
}

const CATEGORIES = [
  { key: 'all', labelKey: 'shop.all' },
  { key: 'art', labelKey: 'shop.catArt' },
  { key: 'template', labelKey: 'shop.catTemplate' },
  { key: 'story', labelKey: 'shop.catStory' },
  { key: 'design', labelKey: 'shop.catDesign' },
  { key: 'music', labelKey: 'shop.catMusic' },
  { key: 'effect', labelKey: 'shop.catEffect' },
] as const;

const TYPES = [
  { key: 'all', labelKey: 'shop.all' },
  { key: 'digital', labelKey: 'shop.digital' },
  { key: 'physical', labelKey: 'shop.physical' },
] as const;

const SORTS = [
  { key: 'trending', labelKey: 'shop.trending' },
  { key: 'new', labelKey: 'shop.new' },
  { key: 'top_rated', labelKey: 'shop.topRated' },
] as const;

function ShopContent() {
  const C = useShopColors();
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [featured, setFeatured] = useState<ShopItem[]>([]);
  const [category, setCategory] = useState('all');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('trending');
  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState<Record<number, boolean>>({});
  const [balance, setBalance] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [ownedCollection, setOwnedCollection] = useState<ShopItem[]>([]);

  function applyWallet(data: {
    balance?: number;
    owned_item_ids?: number[];
    owned_items?: ShopItem[];
  }) {
    setBalance(data.balance ?? 0);
    const map: Record<number, boolean> = {};
    (data.owned_item_ids || []).forEach((id: number) => {
      map[id] = true;
    });
    setOwned(map);
    if (Array.isArray(data.owned_items)) {
      setOwnedCollection(data.owned_items);
    }
  }

  const loadWallet = useCallback(async () => {
    try {
      const res = await apiFetch('shop/items/wallet/');
      if (!res.ok) return;
      applyWallet(await res.json());
    } catch {
      /* keep previous wallet state */
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [iRes, fRes, wRes] = await Promise.all([
        fetch(`${BASE}/?ordering=${sort}&category=${category}&type=${type}`),
        fetch(`${BASE}/featured/`),
        apiFetch('shop/items/wallet/'),
      ]);
      if (iRes.ok) setItems(await iRes.json());
      else {
        setItems([]);
        setLoadError(true);
      }
      if (fRes.ok) setFeatured(await fRes.json());
      if (wRes.ok) applyWallet(await wRes.json());
    } catch {
      setItems([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [sort, category, type]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = searchParams.get('product');
    if (id && !Number.isNaN(parseInt(id, 10))) {
      router.replace(`/shop/${id}`);
    }
  }, [searchParams, router]);

  const openProduct = useCallback(
    (item: ShopItem) => {
      router.push(`/shop/${item.id}`);
    },
    [router],
  );

  const q = search.trim().toLowerCase();
  const filterBySearch = useCallback(
    (list: ShopItem[]) => {
      if (!q) return list;
      return list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.category_display.toLowerCase().includes(q),
      );
    },
    [q],
  );

  const shownItems = useMemo(() => filterBySearch(items), [items, filterBySearch]);
  const shownFeatured = useMemo(() => filterBySearch(featured), [featured, filterBySearch]);

  const ownedItems = useMemo(() => {
    const byId = new Map<number, ShopItem>();
    ownedCollection.forEach((i) => byId.set(i.id, i));
    [...items, ...featured].forEach((i) => {
      if (!owned[i.id]) return;
      const prev = byId.get(i.id);
      byId.set(i.id, prev ? { ...prev, ...i } : i);
    });
    return Array.from(byId.values());
  }, [items, featured, owned, ownedCollection]);

  async function buy(item: ShopItem) {
    if (owned[item.id]) return;
    try {
      const res = await apiFetchJson(`shop/items/${item.id}/purchase/`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data.error === 'Insufficient coins.'
            ? t('shop.insufficientCoins', { price: item.price })
            : data.error || t('shop.purchaseFailed');
        setToast(msg);
        if (typeof data.balance === 'number') setBalance(data.balance);
        setTimeout(() => setToast(''), 3500);
        return;
      }
      setOwned((o) => ({ ...o, [item.id]: true }));
      setOwnedCollection((list) => {
        if (list.some((i) => i.id === item.id)) return list;
        return [item, ...list];
      });
      if (typeof data.balance === 'number') setBalance(data.balance);
      else await loadWallet();
      setItems((list) =>
        list.map((i) =>
          i.id === item.id ? { ...i, sales_count: i.sales_count + 1 } : i,
        ),
      );
      setFeatured((list) =>
        list.map((i) => (i.id === item.id ? { ...i, sales_count: i.sales_count + 1 } : i)),
      );
      setToast(t('shop.unlocked', { name: item.name }));
      setTimeout(() => setToast(''), 3000);
    } catch {
      setToast(t('shop.connectionError'));
      setTimeout(() => setToast(''), 3500);
    }
  }

  const banner = shownFeatured[0];

  return (
    <WorldShell colors={C}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: C.brown }}>🛍️ {t('shop.title')}</h1>
            <p className="text-sm" style={{ color: C.text2 }}>{t('shop.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold shrink-0" style={{ background: C.card, color: C.brownDk }}>
            <SparklesIcon className="h-4 w-4" />
            {balance != null ? balance.toLocaleString() : '…'} {t('common.coins')}
          </div>
        </div>

        {ownedItems.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-semibold mb-3" style={{ color: C.brown }}>
              {t('shop.yourCollection')} ({ownedItems.length})
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {ownedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openProduct(item)}
                  className="shrink-0 w-36 rounded-xl overflow-hidden text-left"
                  style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
                >
                  <div
                    className="h-20 bg-cover bg-center"
                    style={{
                      background: item.cover
                        ? `url(${item.cover}) center/cover`
                        : `linear-gradient(135deg, ${C.card}, ${C.card2})`,
                    }}
                  />
                  <p className="px-2 py-2 text-xs font-semibold line-clamp-2" style={{ color: C.text }}>
                    {item.name}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="relative max-w-md mb-4 hidden sm:block">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.text2 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('shop.search')}
            className="w-full rounded-full pl-10 pr-4 py-2.5 text-sm outline-none"
            style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          />
        </div>

        {/* Featured banner */}
        {banner && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 rounded-2xl overflow-hidden flex flex-col md:flex-row cursor-pointer"
            style={{ background: C.card, border: `1px solid ${C.line}` }}
            onClick={() => openProduct(banner)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && openProduct(banner)}
          >
            <div
              className="md:w-1/2 h-44 md:h-auto bg-center bg-cover"
              style={{ background: banner.cover ? `url(${banner.cover}) center/cover` : `linear-gradient(135deg, ${C.card2}, ${C.card})` }}
            />
            <div className="p-5 md:p-6 md:w-1/2 flex flex-col justify-center">
              <span className="text-xs font-semibold mb-2" style={{ color: C.brown }}>⭐ {t('shop.featuredWeek')}</span>
              <h2 className="text-xl font-bold" style={{ color: C.text }}>{banner.name}</h2>
              <p className="text-sm mt-1 line-clamp-2" style={{ color: C.text2 }}>{banner.description}</p>
              <div className="flex items-center gap-3 mt-4" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => buy(banner)}
                  disabled={owned[banner.id] || (balance != null && balance < banner.price)}
                  className="px-5 py-2.5 rounded-xl font-semibold text-white disabled:opacity-70"
                  style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`, boxShadow: C.btnShadow }}
                >
                  {owned[banner.id]
                    ? t('common.owned')
                    : balance != null && balance < banner.price
                      ? t('common.needCoins')
                      : `${t('shop.getFor')} ${banner.price} ✨`}
                </button>
                <span className="text-xs" style={{ color: C.text2 }}>{t('shop.tapDetails')}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition"
                style={{
                  background: category === c.key ? C.brown : C.white,
                  color: category === c.key ? '#fff' : C.text2,
                  border: `1px solid ${category === c.key ? C.brown : C.line}`,
                }}
              >
                {t(c.labelKey)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {TYPES.map((typ) => (
              <button
                key={typ.key}
                onClick={() => setType(typ.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                style={{
                  background: type === typ.key ? C.card : 'transparent',
                  color: type === typ.key ? C.brownDk : C.text2,
                  border: `1px solid ${type === typ.key ? C.brown : C.line}`,
                }}
              >
                {t(typ.labelKey)}
              </button>
            ))}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium outline-none"
              style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {t(s.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid */}
        <div className="relative sm:hidden mt-4">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.text2 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('shop.search')}
            className="w-full rounded-full pl-10 pr-4 py-2.5 text-sm outline-none"
            style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          />
        </div>

        {loading ? (
          <div className="text-center py-16" style={{ color: C.text2 }}>{t('shop.loadingProducts')}</div>
        ) : loadError ? (
          <div className="rounded-2xl p-10 text-center mt-6" style={{ background: C.card2, border: `1px solid ${C.line}` }}>
            <p className="font-semibold mb-2" style={{ color: C.text }}>{t('shop.loadError')}</p>
            <button
              type="button"
              onClick={() => load()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: C.brownDk }}
            >
              {t('common.tryAgain')}
            </button>
          </div>
        ) : shownItems.length === 0 ? (
          <div className="rounded-2xl p-10 text-center mt-6" style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text2 }}>
            {q ? t('shop.noSearch') : t('shop.empty')}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {shownItems.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                owned={!!owned[item.id]}
                canAfford={balance == null || balance >= item.price}
                onOpen={() => openProduct(item)}
                onBuy={() => buy(item)}
              />
            ))}
          </div>
        )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[1000] px-5 py-3 rounded-xl text-sm font-medium text-white"
            style={{ background: C.brownDk, boxShadow: C.heroShadow }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </WorldShell>
  );
}

export default function MadnessShopPage() {
  const C = useShopColors();
  return (
    <Suspense
      fallback={
        <WorldShell colors={C}>
          <div className="py-20 text-center text-sm" style={{ color: C.text2 }}>
            Loading…
          </div>
        </WorldShell>
      }
    >
      <ShopContent />
    </Suspense>
  );
}

function ProductCard({
  item,
  owned,
  canAfford,
  onOpen,
  onBuy,
}: {
  item: ShopItem;
  owned: boolean;
  canAfford: boolean;
  onOpen: () => void;
  onBuy: () => void;
}) {
  const C = useShopColors();
  const { t } = useLocale();
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
    >
      <button type="button" onClick={onOpen} className="text-left w-full flex flex-col flex-1 min-h-0">
      <div className="relative">
        <div
          className="h-36 bg-center bg-cover w-full"
          style={{ background: item.cover ? `url(${item.cover}) center/cover` : `linear-gradient(135deg, ${C.card}, ${C.card2})` }}
        />
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: C.badgeBg, color: C.brown }}>
          {item.type_display}
        </span>
      </div>
      <div className="p-3 flex flex-col flex-1">
        <div className="flex items-center gap-1 text-xs" style={{ color: C.text2 }}>
          <StarIcon className="h-3.5 w-3.5" style={{ color: '#E0A83B' }} /> {item.rating.toFixed(1)}
          <span className="mx-1">·</span> {item.sales_count} {t('common.sold')}
        </div>
        <h4 className="font-semibold mt-1 leading-snug text-sm line-clamp-1" style={{ color: C.text }}>{item.name}</h4>
        <p className="text-xs mt-0.5 line-clamp-2 flex-1" style={{ color: C.text2 }}>{item.description}</p>
        <div className="text-[11px] mt-2" style={{ color: C.text2 }}>{t('common.by')} {shopCreatorName(item.creator)}</div>
        <span className="font-bold text-sm flex items-center gap-1 mt-2" style={{ color: C.brownDk }}>
          <SparklesIcon className="h-3.5 w-3.5" /> {item.price}
        </span>
      </div>
      </button>
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={onBuy}
          disabled={owned || !canAfford}
          className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-70"
          style={{
            background: owned
              ? '#2f8f6b'
              : !canAfford
                ? C.card2
                : `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`,
            color: !canAfford && !owned ? C.text2 : '#fff',
          }}
        >
          {owned ? t('common.owned') : !canAfford ? t('common.needCoinsShort') : t('common.get')}
        </button>
      </div>
    </motion.div>
  );
}
