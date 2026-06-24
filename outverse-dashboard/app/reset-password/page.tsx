'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { resetPassword } from '@/lib/auth';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';

const PALETTES = {
  light: {
    bgGradient: 'radial-gradient(circle at top right, rgba(160,86,59,0.12), transparent 30%), #FBF3EE',
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
  },
  dark: {
    bgGradient: 'radial-gradient(circle at top right, rgba(34,211,238,0.18), transparent 30%), #050816',
    panel: 'rgba(15, 23, 42, 0.9)',
    panelAlt: 'rgba(30, 41, 59, 0.92)',
    border: 'rgba(125, 211, 252, 0.18)',
    text: '#e2e8f0',
    muted: '#94a3b8',
    accent: '#22d3ee',
    accent2: '#8b5cf6',
    success: '#86efac',
    error: '#fca5a5',
    shadow: '0 24px 80px rgba(2, 6, 23, 0.55)',
  },
};

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) {
      setError(t('auth.missingResetToken'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordMin'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordsMismatch'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await resetPassword(token, password);
      setSuccess(t('auth.passwordUpdated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resetPasswordFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: C.bgGradient }}>
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md rounded-[28px] p-8" style={{ background: C.panel, border: `1px solid ${C.border}`, boxShadow: C.shadow }}>
        <div className="mb-6 text-center">
          <div className="text-3xl mb-2">☄️</div>
          <h1 className="text-2xl font-semibold" style={{ color: C.text }}>{t('auth.newPasswordTitle')}</h1>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>{t('auth.newPasswordSubtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: C.muted }}>{t('auth.newPassword')}</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              className="w-full rounded-2xl px-4 py-3 outline-none"
              style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }}
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: C.muted }}>{t('auth.confirmPassword')}</label>
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              required
              className="w-full rounded-2xl px-4 py-3 outline-none"
              style={{ background: C.panelAlt, border: `1px solid ${C.border}`, color: C.text }}
              placeholder="••••••••"
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
            {loading ? t('auth.updatingPassword') : t('auth.updatePassword')}
          </button>
        </form>
        <div className="mt-6 text-center text-sm" style={{ color: C.muted }}>
          <Link href="/login" className="font-semibold" style={{ color: C.text }}>
            {t('auth.returnToSignIn')}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}