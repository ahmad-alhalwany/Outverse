'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { login, verifyEmail } from '@/lib/auth';
import { useLocale } from '@/components/LocaleProvider';
import { FiEye, FiEyeOff, FiLock, FiMail } from 'react-icons/fi';

const COLORS = {
  page: '#FFF8F5',
  panel: '#FCEBE5',
  card: 'rgba(255,255,255,0.72)',
  cardBorder: 'rgba(160,86,59,0.18)',
  input: '#FFFFFF',
  inputBorder: 'rgba(160,86,59,0.28)',
  primary: '#A0563B',
  primaryDark: '#8B472F',
  text: '#2F211B',
  muted: '#7E6A61',
  line: 'rgba(160,86,59,0.18)',
  success: '#2e7d32',
  error: '#c0392b',
  shadow: '0 28px 80px rgba(160,86,59,0.12)',
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const nextPath = searchParams.get('next') || '/';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const initials = useMemo(() => username.trim().charAt(0).toUpperCase() || 'M', [username]);

  useEffect(() => {
    const token = searchParams.get('token');
    const verified = searchParams.get('verified');
    if (verified && token) {
      verifyEmail(token)
        .then(() => setNotice(t('auth.emailVerified')))
        .catch((err) =>
          setError(err instanceof Error ? err.message : t('auth.verificationFailed')),
        );
    }
  }, [searchParams, t]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.push(nextPath.startsWith('/') ? nextPath : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-10"
      style={{
        background:
          'radial-gradient(circle at top left, rgba(255,255,255,0.95) 0%, rgba(255,248,245,1) 42%, rgba(252,235,229,0.92) 100%)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col justify-center gap-10 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,520px)] lg:items-center lg:gap-16"
      >
        <section className="mx-auto flex w-full max-w-xl flex-col items-center text-center lg:mx-0 lg:items-start lg:text-left">
          <div
            className="mb-8 flex h-20 w-20 items-center justify-center rounded-[24px] p-3"
            style={{ background: COLORS.panel, boxShadow: '0 18px 40px rgba(160,86,59,0.12)' }}
          >
            <div
              className="flex h-full w-full items-center justify-center rounded-[18px] text-4xl font-bold text-white"
              style={{ background: `linear-gradient(180deg, ${COLORS.primary}, ${COLORS.primaryDark})` }}
            >
              {initials}
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: COLORS.text }}>
            {t('auth.welcomeBack')}
          </h1>
          <p className="mt-3 text-lg sm:text-xl" style={{ color: COLORS.muted }}>
            {t('auth.signInSubtitle')}
          </p>
          <div
            className="mt-10 hidden h-[320px] w-full rounded-[32px] border p-8 lg:block"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,255,255,0.28))',
              borderColor: COLORS.cardBorder,
              boxShadow: COLORS.shadow,
            }}
          >
            <div className="grid h-full grid-cols-3 gap-4 opacity-70">
              {Array.from({ length: 9 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[24px]"
                  style={{
                    background:
                      index % 2 === 0
                        ? 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(252,235,229,0.7))'
                        : 'linear-gradient(135deg, rgba(252,235,229,0.9), rgba(255,255,255,0.55))',
                    border: `1px solid ${COLORS.cardBorder}`,
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        <section
          className="mx-auto w-full max-w-xl rounded-[32px] border p-6 sm:p-8 lg:max-w-none"
          style={{ background: COLORS.card, borderColor: COLORS.cardBorder, boxShadow: COLORS.shadow }}
        >
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold" style={{ color: COLORS.text }}>
              {t('auth.signIn')}
            </h2>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="mb-2 block text-base font-semibold" style={{ color: COLORS.text }}>
                {t('auth.email')}
              </label>
              <div
                className="flex items-center gap-3 rounded-2xl border px-4 py-4 transition focus-within:ring-2"
                style={{
                  background: COLORS.input,
                  borderColor: COLORS.inputBorder,
                  color: COLORS.text,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
                }}
              >
                <FiMail className="h-5 w-5 shrink-0" style={{ color: COLORS.muted }} />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-transparent text-base outline-none placeholder:text-[#B4A39B]"
                  style={{ color: COLORS.text }}
                  placeholder="Enter your email"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-base font-semibold" style={{ color: COLORS.text }}>
                {t('auth.password')}
              </label>
              <div
                className="flex items-center gap-3 rounded-2xl border px-4 py-4"
                style={{
                  background: COLORS.input,
                  borderColor: COLORS.inputBorder,
                  color: COLORS.text,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
                }}
              >
                <FiLock className="h-5 w-5 shrink-0" style={{ color: COLORS.muted }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-base outline-none placeholder:text-[#B4A39B]"
                  style={{ color: COLORS.text }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="shrink-0"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <FiEyeOff className="h-5 w-5" style={{ color: COLORS.muted }} />
                  ) : (
                    <FiEye className="h-5 w-5" style={{ color: COLORS.muted }} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-base font-semibold" style={{ color: COLORS.primary }}>
                {t('auth.forgotPassword')}
              </Link>
            </div>

            {notice && <div className="text-sm" style={{ color: COLORS.success }}>{notice}</div>}
            {error && <div className="text-sm" style={{ color: COLORS.error }}>{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl py-4 text-lg font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
              style={{ background: `linear-gradient(180deg, ${COLORS.primary}, ${COLORS.primaryDark})` }}
            >
              {loading ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>

          <div className="my-7 flex items-center gap-4">
            <div className="h-px flex-1" style={{ background: COLORS.line }} />
            <span className="text-base" style={{ color: COLORS.muted }}>
              Or continue with
            </span>
            <div className="h-px flex-1" style={{ background: COLORS.line }} />
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-3 rounded-2xl border px-4 py-4 text-lg font-semibold"
            style={{ background: COLORS.input, borderColor: COLORS.inputBorder, color: COLORS.text }}
          >
            <span className="text-xl">🌐</span>
            <span>Sign in with Google</span>
          </button>

          <p className="mt-8 text-center text-lg" style={{ color: COLORS.muted }}>
            {t('auth.newToOutverse')}{' '}
            <Link href="/register" className="font-semibold" style={{ color: COLORS.primary }}>
              Sign up
            </Link>
          </p>
        </section>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}