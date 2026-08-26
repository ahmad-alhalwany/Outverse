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
  creator: {
    id?: number;
    username: string;
    first_name?: string;
    last_name?: string;
    avatar?: string | null;
  } | null;
};

export type ShopTransaction = {
  id: number;
  item: ShopItem;
  amount: number;
  status: string;
  timestamp: string;
  shipping_address?: string;
  fulfillment_status: string;
  fulfillment_status_display: string;
  buyer_username?: string;
};

export type CreatorSales = {
  revenue: number;
  orders_count: number;
  active_products: number;
  pending_fulfillment: number;
  sales_by_day?: { day: string; revenue: number; orders: number }[];
  items: ShopItem[];
  orders: ShopTransaction[];
};

export const IDEA_KIND_ICONS: Record<string, string> = {
  cursed_prompt: '🌌',
  alternate_you: '🎭',
  blind_drop: '📦',
  constellation_pack: '🧩',
  bottle: '⏳',
  reverse_commission: '🃏',
};

export function shopCreatorName(c: ShopItem['creator']) {
  if (!c) return 'Cosonova';
  const full = `${c.first_name || ''} ${c.last_name || ''}`.trim();
  return full || c.username;
}
