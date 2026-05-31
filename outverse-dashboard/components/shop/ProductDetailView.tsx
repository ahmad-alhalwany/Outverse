'use client';

import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { shopCreatorName, type ShopItem } from '@/lib/shopTypes';

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
    btnShadow: '0 6px 18px rgba(160,86,59,0.3)',
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
    btnShadow: '0 6px 20px rgba(106,0,255,0.25)',
  },
};

type Props = {
  item: ShopItem;
  owned: boolean;
  canAfford: boolean;
  balance: number | null;
  onBuy: () => void;
};

export default function ProductDetailView({
  item,
  owned,
  canAfford,
  balance,
  onBuy,
}: Props) {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];

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
          <button
            type="button"
            onClick={onBuy}
            disabled={owned || !canAfford}
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
                : `${t('shop.unlockFor')} ${item.price} ✨`}
          </button>
        </div>
      </article>
    </div>
  );
}
