'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import WorldShell from '@/components/world/WorldShell';
import ProductDetailView from '@/components/shop/ProductDetailView';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { apiUrl } from '@/lib/api';
import type { ShopItem } from '@/lib/shopTypes';

const BASE = apiUrl('shop/items');

const PALETTES = {
  light: {
    cream: '#FBF3EE',
    text: '#3D2B22',
    text2: '#9A8278',
    brownDk: '#854330',
  },
  dark: {
    cream: '#1a1a2e',
    text: '#F5F6FA',
    text2: '#B3B3B3',
    brownDk: '#a0563b',
  },
};

export default function ShopProductPage() {
  const params = useParams();
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [item, setItem] = useState<ShopItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [owned, setOwned] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const [pRes, wRes] = await Promise.all([
        fetch(`${BASE}/${id}/`),
        apiFetch('shop/items/wallet/'),
      ]);
      if (pRes.ok) {
        setItem(await pRes.json());
      } else if (pRes.status === 404) {
        setNotFound(true);
        setItem(null);
      } else {
        setItem(null);
      }
      if (wRes.ok) {
        const w = await wRes.json();
        setBalance(w.balance ?? 0);
        const ownedIds: number[] = w.owned_item_ids || [];
        setOwned(ownedIds.includes(Number(id)));
      }
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function buy() {
    if (!item || owned) return;
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
      setOwned(true);
      if (typeof data.balance === 'number') setBalance(data.balance);
      setToast(t('shop.unlocked', { name: item.name }));
      setTimeout(() => setToast(''), 3000);
    } catch {
      setToast(t('shop.connectionError'));
      setTimeout(() => setToast(''), 3500);
    }
  }

  return (
    <WorldShell colors={PALETTES[theme]}>
      {loading ? (
        <p className="text-center py-16 text-sm" style={{ color: C.text2 }}>
          {t('common.loading')}
        </p>
      ) : notFound || !item ? (
        <div className="text-center py-16">
          <p className="mb-4" style={{ color: C.text2 }}>
            {t('shop.productNotFound')}
          </p>
          <button
            type="button"
            onClick={() => router.push('/shop')}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: C.brownDk }}
          >
            {t('shop.backToShop')}
          </button>
        </div>
      ) : (
        <ProductDetailView
          item={item}
          owned={owned}
          canAfford={balance == null || balance >= item.price}
          balance={balance}
          onBuy={() => void buy()}
        />
      )}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] px-5 py-3 rounded-xl text-sm font-medium text-white"
          style={{ background: C.brownDk }}
        >
          {toast}
        </div>
      )}
    </WorldShell>
  );
}
