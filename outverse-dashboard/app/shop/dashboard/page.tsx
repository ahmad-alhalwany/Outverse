'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch, apiFetchJson } from '@/lib/api';
import type { CreatorSales, ShopItem } from '@/lib/shopTypes';
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
import ProductFormModal from '@/components/shop/ProductFormModal';

const PALETTES = {
  light: {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    successBg: '#e8f3ee',
    successText: '#2f8f6b',
  },
  dark: {
    cream: '#14102A',
    card: '#1E1740',
    card2: '#251B4D',
    white: '#2A2154',
    brown: '#C4B5FD',
    brownDk: '#A78BFA',
    text: '#F5F3FF',
    text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
    successBg: 'rgba(74,222,128,0.15)',
    successText: '#4ade80',
  },
} as const;

export default function CreatorDashboardPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const [data, setData] = useState<CreatorSales | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('shop/items/my-sales/');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteItem(id: number) {
    if (!window.confirm(t('creatorDashboard.deleteConfirm'))) return;
    setDeletingId(id);
    try {
      const res = await apiFetch(`shop/items/${id}/`, { method: 'DELETE' });
      if (res.ok) void load();
    } finally {
      setDeletingId(null);
    }
  }

  async function markShipped(transactionId: number) {
    setBusyId(transactionId);
    try {
      const res = await apiFetchJson('shop/items/fulfillment/', {
        method: 'POST',
        json: { transaction_id: transactionId, fulfillment_status: 'shipped' },
      });
      if (res.ok) void load();
    } finally {
      setBusyId(null);
    }
  }

  const kpis = [
    { label: t('creatorDashboard.revenue'), value: `${data?.revenue ?? 0} ✨` },
    { label: t('creatorDashboard.orders'), value: data?.orders_count ?? 0 },
    { label: t('creatorDashboard.activeProducts'), value: data?.active_products ?? 0 },
    { label: t('creatorDashboard.pendingFulfillment'), value: data?.pending_fulfillment ?? 0 },
  ];

  return (
    <WorldShell colors={C}>
      <div className="max-w-6xl mx-auto pt-6">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-sm font-medium mb-4 hover:opacity-80"
          style={{ color: C.text2 }}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t('shop.backToShop')}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: C.brown }}>
            {t('creatorDashboard.title')}
          </h1>
          <button
            type="button"
            onClick={() => { setEditingItem(null); setFormOpen(true); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold text-white shrink-0"
            style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}
          >
            <PlusIcon className="h-4 w-4" />
            {t('creatorDashboard.addProduct')}
          </button>
        </div>
        <p className="text-sm mb-6" style={{ color: C.text2 }}>
          {t('creatorDashboard.subtitle')}{' '}
          <Link href="/analytics" className="underline" style={{ color: C.brown }}>
            {t('creatorDashboard.viewFullAnalytics')}
          </Link>
        </p>

        {loading ? (
          <div className="py-16 text-center" style={{ color: C.text2 }}>{t('common.loading')}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="rounded-2xl p-4 text-center" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                  <div className="text-xl font-bold" style={{ color: C.brown }}>{kpi.value}</div>
                  <div className="text-xs mt-1" style={{ color: C.text2 }}>{kpi.label}</div>
                </div>
              ))}
            </div>

            {data?.sales_by_day && data.sales_by_day.length > 0 && (
              <section className="mb-8 rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                <h2 className="text-sm font-semibold mb-3" style={{ color: C.text }}>{t('creatorDashboard.salesLast28Days')}</h2>
                <div className="flex items-end gap-1 h-24">
                  {data.sales_by_day.map((row) => {
                    const max = Math.max(1, ...data.sales_by_day!.map((d) => d.revenue));
                    const h = Math.max(4, Math.round((row.revenue / max) * 100));
                    return (
                      <div key={row.day} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t" style={{ height: `${h}%`, background: C.brown, minHeight: 4 }} title={`${row.revenue} ✨`} />
                        <span className="text-[8px] truncate w-full text-center" style={{ color: C.text2 }}>
                          {row.day.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-3" style={{ color: C.text }}>{t('creatorDashboard.yourProducts')}</h2>
              {!data?.items.length ? (
                <div className="rounded-2xl p-8 text-center" style={{ background: C.card2, color: C.text2 }}>
                  {t('creatorDashboard.noProducts')}
                </div>
              ) : (
                <div className="grid gap-3">
                  {data.items.map((item) => (
                    <div key={item.id} className="rounded-2xl p-4 flex items-center justify-between gap-3" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                      <div className="min-w-0">
                        <p className="font-semibold truncate" style={{ color: C.text }}>{item.name}</p>
                        <p className="text-xs" style={{ color: C.text2 }}>
                          {item.price} ✨ · {item.sales_count} {t('creatorDashboard.sold')}
                          {item.stock != null && ` · ${t('shop.leftInStock', { count: item.stock })}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ background: item.is_available ? C.successBg : C.card2, color: item.is_available ? C.successText : C.text2 }}
                        >
                          {item.is_available ? t('creatorDashboard.visible') : t('creatorDashboard.hidden')}
                        </span>
                        <button
                          type="button"
                          onClick={() => { setEditingItem(item); setFormOpen(true); }}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ background: C.card2, color: C.brownDk }}
                        >
                          {t('creatorDashboard.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteItem(item.id)}
                          disabled={deletingId === item.id}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold disabled:opacity-60"
                          style={{ background: C.card2, color: '#c0392b' }}
                        >
                          {t('creatorDashboard.deleteProduct')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: C.text }}>{t('creatorDashboard.orders')}</h2>
              {!data?.orders.length ? (
                <div className="rounded-2xl p-8 text-center" style={{ background: C.card2, color: C.text2 }}>
                  {t('creatorDashboard.noOrders')}
                </div>
              ) : (
                <div className="grid gap-3">
                  {data.orders.map((order) => (
                    <div key={order.id} className="rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                      <div className="min-w-0">
                        <p className="font-semibold truncate" style={{ color: C.text }}>{order.item.name}</p>
                        <p className="text-xs" style={{ color: C.text2 }}>
                          @{order.buyer_username} · {order.amount} ✨ · {new Date(order.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      {order.item.type === 'physical' && order.fulfillment_status !== 'not_applicable' ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: C.card2, color: C.brownDk }}>
                            {order.fulfillment_status_display}
                          </span>
                          {order.fulfillment_status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => void markShipped(order.id)}
                              disabled={busyId === order.id}
                              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-60"
                              style={{ background: C.brownDk }}
                            >
                              {busyId === order.id ? t('creatorDashboard.updating') : t('creatorDashboard.markShipped')}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold shrink-0" style={{ background: C.successBg, color: C.successText }}>
                          {order.status === 'completed'
                            ? t('shop.txStatusCompleted')
                            : order.status === 'failed'
                              ? t('shop.txStatusFailed')
                              : t('shop.txStatusPending')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
      {formOpen && (
        <ProductFormModal
          item={editingItem}
          onClose={() => setFormOpen(false)}
          onSaved={() => void load()}
        />
      )}
    </WorldShell>
  );
}
