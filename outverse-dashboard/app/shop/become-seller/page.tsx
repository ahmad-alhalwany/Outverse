'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { fetchSellerApplicationStatus, submitSellerApplication } from '@/lib/accountSecurityApi';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

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
  },
} as const;

export default function BecomeSellerPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const [isSeller, setIsSeller] = useState(false);
  const [requests, setRequests] = useState<{ id: number; status: string; reason: string; review_note?: string }[]>([]);
  const [reason, setReason] = useState('');
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchSellerApplicationStatus();
    if (data) {
      setIsSeller(data.is_shop_seller);
      setRequests(data.requests);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = requests.find((r) => r.status === 'pending');

  async function submit() {
    setSaving(true);
    setStatus('');
    try {
      const ok = await submitSellerApplication(reason, link ? [link] : []);
      setStatus(ok ? t('sellerApplication.sent') : t('sellerApplication.error'));
      if (ok) void load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorldShell colors={C}>
      <div className="max-w-lg mx-auto pt-6">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 text-sm font-medium mb-4 hover:opacity-80"
          style={{ color: C.text2 }}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t('shop.backToShop')}
        </Link>

        <h1 className="text-2xl font-bold mb-1" style={{ color: C.brown }}>
          {t('sellerApplication.title')}
        </h1>
        <p className="text-sm mb-6" style={{ color: C.text2 }}>
          {t('sellerApplication.subtitle')}
        </p>

        {loading ? (
          <div className="py-16 text-center" style={{ color: C.text2 }}>{t('common.loading')}</div>
        ) : isSeller ? (
          <div className="rounded-2xl p-5 text-center" style={{ background: C.card2, color: C.text }}>
            {t('sellerApplication.alreadySeller')}
          </div>
        ) : pending ? (
          <div className="rounded-2xl p-5" style={{ background: C.card2 }}>
            <p className="font-semibold mb-1" style={{ color: C.text }}>{t('sellerApplication.pendingTitle')}</p>
            <p className="text-sm" style={{ color: C.text2 }}>{pending.reason}</p>
          </div>
        ) : (
          <div className="rounded-2xl p-5" style={{ background: C.card2 }}>
            <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('sellerApplication.reasonLabel')}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none"
              style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
              placeholder={t('sellerApplication.reasonPlaceholder')}
            />
            <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('sellerApplication.linkLabel')}</label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none"
              style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
              placeholder="https://…"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || reason.trim().length < 20}
              className="w-full rounded-xl py-3 font-semibold text-white disabled:opacity-60"
              style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}
            >
              {saving ? t('creatorDashboard.saving') : t('sellerApplication.submit')}
            </button>
            {status && <p className="text-xs mt-2" style={{ color: C.text2 }}>{status}</p>}
          </div>
        )}

        {requests.some((r) => r.status === 'rejected') && !pending && !isSeller && (
          <p className="text-xs mt-3" style={{ color: C.text2 }}>{t('sellerApplication.rejectedHint')}</p>
        )}
      </div>
    </WorldShell>
  );
}
