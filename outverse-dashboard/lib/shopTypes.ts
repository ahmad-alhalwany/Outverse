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
  cover: string;
  rating: number;
  sales_count: number;
  is_featured: boolean;
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
};

export function shopCreatorName(c: ShopItem['creator']) {
  if (!c) return 'Outverse';
  const full = `${c.first_name || ''} ${c.last_name || ''}`.trim();
  return full || c.username;
}
