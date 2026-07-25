'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { shopCreatorName, type ShopItem } from '@/lib/shopTypes';

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
    btnShadow: '0 6px 18px rgba(124,58,237,0.3)',
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
    btnShadow: '0 6px 20px rgba(167,139,250,0.3)',
  },
};

type Props = {
  item: ShopItem;
  owned: boolean;
  canAfford: boolean;
  balance: number | null;
  onBuy: (shippingAddress?: string) => void;
  accessUrl?: string | null;
};

export default function ProductDetailView({
  item,
  owned,
  canAfford,
  balance,
  onBuy,
  accessUrl,
}: Props) {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const [shippingAddress, setShippingAddress] = useState('');
  const isPhysical = item.type === 'physical';
  const shippingMissing = isPhysical && !owned && !shippingAddress.trim();

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/shop"
        className="inline-flex items-center gap-2 text-sm font-medium mb-4 hover:opacity-80"
        style={{ color: C.text2 }}
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {t('shop.backToShop')}
      </Link>

      <article
        className="rounded-2xl overflow-hidden"
        style={{ background: C.white, border: `1px solid ${C.line}` }}
      >
        <div
          className="h-56 sm:h-64 bg-cover bg-center"
          style={{
            background: item.cover
              ? `url(${item.cover}) center/cover`
              : `linear-gradient(135deg, ${C.card}, ${C.card2})`,
          }}
        />
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            <span
              className="px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: C.card2, color: C.brown }}
            >
              {item.category_display}
            </span>
            <span
              className="px-2.5 py-1 rounded-full text-xs"
              style={{ background: C.cream, color: C.text2, border: `1px solid ${C.line}` }}
            >
              {item.type_display}
            </span>
            {item.is_featured && (
              <span
                className="px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                style={{ background: C.brown }}
              >
                {t('shop.featured')}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold mt-3" style={{ color: C.text }}>
            {item.name}
          </h1>
          <p
            className="text-sm mt-3 leading-relaxed whitespace-pre-wrap"
            style={{ color: C.text2 }}
          >
            {item.description}
          </p>
          <div className="flex items-center gap-3 mt-4 text-sm" style={{ color: C.text2 }}>
            <span className="flex items-center gap-1">
              <StarIcon className="h-4 w-4" style={{ color: '#E0A83B' }} />
              {item.rating.toFixed(1)}
            </span>
            <span>
              {item.sales_count} {t('common.sold')}
            </span>
            <span>
              {t('common.by')} {shopCreatorName(item.creator)}
            </span>
          </div>
          <div
            className="mt-5 p-4 rounded-xl flex items-center justify-between flex-wrap gap-3"
            style={{ background: C.card2, border: `1px solid ${C.line}` }}
          >
            <div>
              <p className="text-xs" style={{ color: C.text2 }}>
                {t('shop.price')}
              </p>
              <p className="text-lg font-bold flex items-center gap-1" style={{ color: C.brownDk }}>
                <SparklesIcon className="h-5 w-5" /> {item.price} {t('common.coins')}
              </p>
            </div>
            {balance != null && (
              <p className="text-xs" style={{ color: C.text2 }}>
                {t('shop.yourBalance')}: {balance.toLocaleString()}
              </p>
            )}
          </div>
          {isPhysical && !owned && (
            <label className="block mt-4">
              <span className="text-xs font-semibold" style={{ color: C.text2 }}>
                {t('shop.shippingAddress')}
              </span>
              <textarea
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => onBuy(shippingAddress.trim())}
            disabled={owned || !canAfford || shippingMissing}
            className="mt-4 w-full py-3 rounded-xl font-semibold text-white disabled:opacity-70"
            style={{
              background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`,
              boxShadow: C.btnShadow,
            }}
          >
            {owned
              ? t('common.owned')
              : !canAfford
                ? t('shop.notEnoughCoins')
                : shippingMissing
                  ? t('shop.shippingAddressRequired')
                  : `${t('shop.unlockFor')} ${item.price} ✨`}
          </button>
          {owned && item.type === 'digital' && accessUrl && (
            <a
              href={accessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block w-full py-3 rounded-xl font-semibold text-center"
              style={{ background: C.card2, color: C.brownDk, border: `1px solid ${C.line}` }}
            >
              {t('shop.downloadAccess')}
            </a>
          )}
        </div>
      </article>
    </div>
  );
}
