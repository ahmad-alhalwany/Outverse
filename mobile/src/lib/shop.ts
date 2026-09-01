import { mediaUrl } from '@/api/config';

export type ShopPalette = {
  cream: string;
  card: string;
  card2: string;
  white: string;
  brown: string;
  brownDk: string;
  text: string;
  text2: string;
  line: string;
  overlay: string;
  badgeBg: string;
  successBg: string;
  successText: string;
  stockHot: string;
};

export type ShopCreator = {
  id?: number;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar?: string | null;
} | null;

export type ShopItem = {
  id: number;
  name: string;
  description: string;
  price: number;
  type: string;
  type_display: string;
  category: string;
  category_display: string;
  cover_url?: string;
  download_url?: string;
  cover: string;
  rating: number;
  sales_count: number;
  stock: number | null;
  idea_kind?: string;
  idea_kind_display?: string;
  unlock_at?: string | null;
  content_locked?: boolean;
  is_featured: boolean;
  is_available: boolean;
  creator: ShopCreator;
};

export type ShopTransaction = {
  id: number;
  item: ShopItem;
  amount: number;
  status: string;
  timestamp?: string;
  created_at?: string;
  shipping_address?: string;
  fulfillment_status: string;
  fulfillment_status_display: string;
  buyer_username?: string;
};

export type SellerSales = {
  revenue: number;
  orders_count: number;
  active_products: number;
  pending_fulfillment: number;
  sales_by_day: { day: string; revenue: number; orders: number }[];
  items: ShopItem[];
  orders: ShopTransaction[];
};

export type ShopWallet = {
  balance: number;
  owned_item_ids: number[];
  owned_items: ShopItem[];
};

export const SHOP_CATEGORIES = [
  { key: 'all', labelKey: 'shop.all' },
  { key: 'art', labelKey: 'shop.catArt' },
  { key: 'template', labelKey: 'shop.catTemplate' },
  { key: 'story', labelKey: 'shop.catStory' },
  { key: 'design', labelKey: 'shop.catDesign' },
  { key: 'music', labelKey: 'shop.catMusic' },
  { key: 'effect', labelKey: 'shop.catEffect' },
] as const;

export const SHOP_TYPES = [
  { key: 'all', labelKey: 'shop.all' },
  { key: 'digital', labelKey: 'shop.digital' },
  { key: 'physical', labelKey: 'shop.physical' },
  { key: 'idea', labelKey: 'shop.idea' },
] as const;

export const SHOP_SORTS = [
  { key: 'trending', labelKey: 'shop.trending' },
  { key: 'new', labelKey: 'shop.new' },
  { key: 'top_rated', labelKey: 'shop.topRated' },
] as const;

export const IDEA_KIND_ICONS: Record<string, string> = {
  cursed_prompt: '🌌',
  alternate_you: '🎭',
  blind_drop: '📦',
  constellation_pack: '🧩',
  bottle: '⏳',
  reverse_commission: '🃏',
};

export function useShopPalette(isDark: boolean): ShopPalette {
  if (isDark) {
    return {
      cream: '#14102A',
      card: '#1E1740',
      card2: '#251B4D',
      white: '#2A2154',
      brown: '#C4B5FD',
      brownDk: '#A78BFA',
      text: '#F5F3FF',
      text2: '#B0A6D9',
      line: 'rgba(167,139,250,0.20)',
      overlay: 'rgba(10,8,24,0.65)',
      badgeBg: 'rgba(37,27,77,0.92)',
      successBg: 'rgba(74,222,128,0.15)',
      successText: '#4ade80',
      stockHot: '#f87171',
    };
  }
  return {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    overlay: 'rgba(33,27,61,0.45)',
    badgeBg: 'rgba(255,255,255,0.92)',
    successBg: '#e8f3ee',
    successText: '#2f8f6b',
    stockHot: '#c0392b',
  };
}

export function shopCreatorName(creator: ShopCreator) {
  if (!creator) return 'Cosonova';
  const full = `${creator.first_name || ''} ${creator.last_name || ''}`.trim();
  return full || creator.username;
}

export function shopCover(item: Pick<ShopItem, 'cover' | 'cover_url'>) {
  return mediaUrl(item.cover || item.cover_url || '');
}

export function shopAccessUrl(item: ShopItem) {
  return item.download_url || item.cover_url || item.cover || '';
}

export function asShopItems(data: unknown): ShopItem[] {
  if (Array.isArray(data)) return data as ShopItem[];
  if (data && typeof data === 'object') {
    const obj = data as { results?: ShopItem[] };
    if (Array.isArray(obj.results)) return obj.results;
  }
  return [];
}

export function asShopWallet(data: unknown): ShopWallet {
  const obj = (data && typeof data === 'object' ? data : {}) as Partial<ShopWallet>;
  return {
    balance: typeof obj.balance === 'number' ? obj.balance : 0,
    owned_item_ids: Array.isArray(obj.owned_item_ids) ? obj.owned_item_ids : [],
    owned_items: Array.isArray(obj.owned_items) ? obj.owned_items : [],
  };
}

export type CoinPack = {
  id: number;
  name: string;
  coins: number;
  price_usd_cents: number;
  available: boolean;
};

export function asCoinPacks(data: unknown): CoinPack[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return rows
    .map((row) => {
      const p = (row || {}) as Partial<CoinPack> & { stripe_price_id?: string };
      return {
        id: Number(p.id),
        name: String(p.name || ''),
        coins: Number(p.coins || 0),
        price_usd_cents: Number(p.price_usd_cents || 0),
        available: p.available !== false,
      };
    })
    .filter((p) => p.id);
}

export function formatUsdCents(cents: number) {
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

export function asSellerSales(data: unknown): SellerSales | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  return {
    revenue: Number(obj.revenue || 0),
    orders_count: Number(obj.orders_count || 0),
    active_products: Number(obj.active_products || 0),
    pending_fulfillment: Number(obj.pending_fulfillment || 0),
    sales_by_day: Array.isArray(obj.sales_by_day)
      ? obj.sales_by_day.map((row) => {
          const item = (row || {}) as Record<string, unknown>;
          return {
            day: String(item.day || ''),
            revenue: Number(item.revenue || 0),
            orders: Number(item.orders || 0),
          };
        })
      : [],
    items: asShopItems(obj.items),
    orders: asShopTransactions(obj.orders),
  };
}

export function asShopTransactions(data: unknown): ShopTransaction[] {
  if (Array.isArray(data)) return data as ShopTransaction[];
  if (data && typeof data === 'object') {
    const obj = data as { results?: ShopTransaction[] };
    if (Array.isArray(obj.results)) return obj.results;
  }
  return [];
}

export function purchaseErrorMessage(
  error: unknown,
  t: (key: string, vars?: Record<string, string | number>) => string,
  price?: number,
) {
  const data = (error as { response?: { data?: { error?: string; price?: number } } })?.response?.data || {};
  if (data.error === 'Insufficient coins.') {
    return t('shop.insufficientCoins', { price: data.price ?? price ?? 0 });
  }
  if (data.error === 'This item is out of stock.') return t('shop.outOfStock');
  if (data.error === 'A shipping address is required for physical items.') {
    return t('shop.shippingAddressRequired');
  }
  if (data.error === 'You cannot buy your own product.') return t('shop.cannotBuyOwn');
  if (data.error === 'You already own this item.') return t('common.owned');
  return data.error || t('shop.purchaseFailed');
}

export function axiosBalance(error: unknown): number | undefined {
  const balance = (error as { response?: { data?: { balance?: number } } })?.response?.data?.balance;
  return typeof balance === 'number' ? balance : undefined;
}
