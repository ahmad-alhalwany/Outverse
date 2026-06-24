'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { forgotPassword } from '@/lib/auth';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';

const PALETTES = {
  light: {
    panel: '#FFFFFF',
    panelAlt: '#F9ECE4',
    border: 'rgba(160,86,59,0.14)',
    text: '#3D2B22',
    muted: '#9A8278',
    accent: '#A0563B',
    accent2: '#854330',
    success: '#2f8f6b',
    error: '#c0392b',
    shadow: '0 24px 80px rgba(61,43,34,0.18)',
    bgGradient: 'radial-gradient(circle at top, rgba(160,86,59,0.12), transparent 35%), #FBF3EE',
  },
  dark: {
    panel: 'rgba(17, 24, 39, 0.88)',
    panelAlt: 'rgba(30, 41, 59, 0.92)',
    border: 'rgba(148, 163, 184, 0.18)',
    text: '#e5eefc',
    muted: '#94a3b8',
    accent: '#8b5cf6',
    accent2: '#06b6d4',
    success: '#86efac',
    error: '#fca5a5',
    shadow: '0 24px 80px rgba(15, 23, 42, 0.45)',
    bgGradient: 'radial-gradient(circle at top, rgba(139,92,246,0.22), transparent 35%), #0b1020',
  },
};

export default function ForgotPasswordPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const message = await forgotPassword(email.trim());
      setSuccess(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resetEmailFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: C.bgGradient }}>
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-[28px] p-8" style={{ background: C.panel, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
        <div className="mb-6 text-center">
          <div className="text-3xl mb-2">✦</div>
          <h1 className="text-2xl font-semibold" style={{ color: C.text }}>{t('auth.resetPasswordTitle')}</h1>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>{t('auth.resetPasswordSubtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: C.muted }}>{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-2xl px-4 py-3 outline-none"
              style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }}
              placeholder="you@example.com"
            />
          </div>
          {success && <p className="text-sm" style={{ color: C.success }}>{success}</p>}
          {error && <p className="text-sm" style={{ color: C.error }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl py-3 font-semibold text-white disabled:opacity-60"
            style={{ background: `linear-gradient(90deg, ${C.accent}, ${C.accent2})` }}
          >
            {loading ? t('auth.sending') : t('auth.sendResetLink')}
          </button>
        </form>
        <div className="mt-6 text-center text-sm" style={{ color: C.muted }}>
          {t('auth.rememberedPassword')}{' '}
          <Link href="/login" className="font-semibold" style={{ color: C.text }}>
            {t('auth.backToSignIn')}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}