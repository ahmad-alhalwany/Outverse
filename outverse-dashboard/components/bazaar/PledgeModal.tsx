'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetchJson } from '@/lib/api';
import type { BazaarIdea } from '@/lib/bazaarTypes';

const PALETTES = {
  light: {
    cream: '#F3F0FC',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    overlay: 'rgba(33,27,61,0.45)',
    modalShadow: '0 20px 60px rgba(33,27,61,0.3)',
  },
  dark: {
    cream: '#14102A',
    card2: '#251B4D',
    white: '#2A2154',
    brown: '#C4B5FD',
    text: '#F5F3FF',
    text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
    overlay: 'rgba(10,8,24,0.65)',
    modalShadow: '0 20px 60px rgba(0,0,0,0.45)',
  },
};

export default function PledgeModal({
  idea,
  onClose,
  onPledged,
}: {
  idea: BazaarIdea;
  onClose: () => void;
  onPledged: (funding_raised: number) => void;
}) {
  const { theme } = useTheme();
  const C = PALETTES[theme];
  const { t } = useLocale();
  const [amount, setAmount] = useState('50');
  const [anonymous, setAnonymous] = useState(false);
  const [pledging, setPledging] = useState(false);
  const [error, setError] = useState('');

  async function confirmPledge() {
    const value = parseInt(amount, 10);
    if (!Number.isFinite(value) || value <= 0) {
      setError(t('bazaar.pledgeInvalid'));
      return;
    }
    setPledging(true);
    setError('');
    try {
      const res = await apiFetchJson(`ideas/${idea.id}/pledge/`, {
        method: 'POST',
        json: { amount: value, anonymous },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.detail === 'Insufficient coins.'
            ? t('bazaar.insufficientCoins')
            : data.detail || t('bazaar.pledgeFailed'),
        );
        return;
      }
      onPledged(data.funding_raised);
    } catch {
      setError(t('bazaar.pledgeFailed'));
    } finally {
      setPledging(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: C.overlay }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: C.cream, border: `1px solid ${C.line}`, boxShadow: C.modalShadow }}
      >
        <h2 className="text-lg font-semibold" style={{ color: C.text }}>{t('bazaar.pledge')}</h2>
        <p className="text-sm mt-2" style={{ color: C.text2 }}>{t('bazaar.pledgeConfirm')}</p>
        <label className="block mt-4">
          <span className="text-sm font-medium" style={{ color: C.text }}>{t('bazaar.pledgeAmount')}</span>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-2 w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          />
        </label>
        <label className="mt-4 flex items-center gap-2 text-sm" style={{ color: C.text }}>
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
          {t('bazaar.pledgeAnonymous')}
        </label>
        {error && <div className="text-sm mt-3" style={{ color: '#c0392b' }}>{error}</div>}
        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl py-3 text-sm font-semibold" style={{ background: C.card2, color: C.text }}>{t('common.cancel')}</button>
          <button type="button" onClick={() => void confirmPledge()} disabled={pledging} className="flex-1 rounded-xl py-3 text-sm font-semibold text-white" style={{ background: C.brown }}>
            {pledging ? t('bazaar.pledging') : t('bazaar.pledge')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
