'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch, mediaUrl } from '@/lib/api';
import type { ShopTransaction } from '@/lib/shopTypes';
import { ArrowLeftIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

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
    shadowSm: '0 2px 12px rgba(160,86,59,0.06)',
    successBg: '#e8f3ee',
    successText: '#2f8f6b',
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
    shadowSm: '0 2px 12px rgba(106,0,255,0.12)',
    successBg: 'rgba(74,222,128,0.15)',
    successText: '#4ade80',
  },
};

export default function ShopOrdersPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const [transactions, setTransactions] = useState<ShopTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await apiFetch('shop/items/transactions/');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch {
      setTransactions([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const completedCount = useMemo(
    () => transactions.filter((tx) => tx.status === 'completed').length,
    [transactions],
  );

  return (
    <WorldShell colors={C}>
      <div className="max-w-5xl mx-auto">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-sm font-medium mb-4 hover:opacity-80"
          style={{ color: C.text2 }}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t('shop.backToShop')}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: C.brown }}>
              {t('shop.orderHistory')}
            </h1>
            <p className="text-sm" style={{ color: C.text2 }}>
              {t('shop.orderHistorySubtitle')}
            </p>
          </div>
          <div
            className="px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: C.card, color: C.brownDk }}
          >
            {completedCount} {t('shop.completedOrders')}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16" style={{ color: C.text2 }}>
            {t('shop.loadingOrders')}
          </div>
        ) : loadError ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: C.card2, border: `1px solid ${C.line}` }}
          >
            <p className="font-semibold mb-2" style={{ color: C.text }}>
              {t('shop.ordersLoadError')}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: C.brownDk }}
            >
              {t('common.tryAgain')}
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text2 }}
          >
            {t('shop.noOrders')}
          </div>
        ) : (
          <div className="grid gap-4">
            {transactions.map((tx) => {
              const accessUrl =
                tx.item.type === 'digital'
                  ? tx.item.cover_url || tx.item.cover || ''
                  : '';
              return (
                <article
                  key={tx.id}
                  className="rounded-2xl p-4 md:p-5"
                  style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-4 min-w-0">
                      <div
                        className="w-16 h-16 rounded-xl shrink-0 bg-center bg-cover"
                        style={{
                          background: tx.item.cover
                            ? `url(${mediaUrl(tx.item.cover) || tx.item.cover}) center/cover`
                            : `linear-gradient(135deg, ${C.card}, ${C.card2})`,
                        }}
                      />
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold truncate" style={{ color: C.text }}>
                          {tx.item.name}
                        </h2>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                          <span
                            className="px-2.5 py-1 rounded-full"
                            style={{ background: C.card2, color: C.brown }}
                          >
                            {tx.item.type_display}
                          </span>
                          <span
                            className="px-2.5 py-1 rounded-full"
                            style={{ background: C.successBg, color: C.successText }}
                          >
                            {tx.status}
                          </span>
                        </div>
                        <p className="text-xs mt-2" style={{ color: C.text2 }}>
                          {new Date(tx.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 md:justify-end">
                      <div className="text-right">
                        <p className="text-xs" style={{ color: C.text2 }}>
                          {t('shop.pricePaid')}
                        </p>
                        <p className="text-lg font-bold" style={{ color: C.brownDk }}>
                          {tx.amount} ✨
                        </p>
                      </div>
                      {accessUrl ? (
                        <a
                          href={accessUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                          style={{ background: C.card2, color: C.brownDk, border: `1px solid ${C.line}` }}
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          {t('shop.downloadAccess')}
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </WorldShell>
  );
}