'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { login, verifyEmail, resendVerificationEmail } from '@/lib/auth';
import { loginWith2fa, loginWithGoogle, loginWithApple } from '@/lib/accountSecurityApi';
import { useLocale } from '@/components/LocaleProvider';
import { FiEye, FiEyeOff, FiLock, FiMail } from 'react-icons/fi';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number>,
          ) => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: Record<string, string | boolean>) => void;
        signIn: () => Promise<{ authorization?: { id_token?: string } }>;
      };
    };
  }
}

const COLORS = {
  page: '#F3F0FC',
  panel: '#EDE4FB',
  card: 'rgba(255,255,255,0.72)',
  cardBorder: 'rgba(124,58,237,0.18)',
  input: '#FFFFFF',
  inputBorder: 'rgba(124,58,237,0.28)',
  primary: '#7C3AED',
  primaryDark: '#5B21B6',
  text: '#211B3D',
  muted: '#79709E',
  line: 'rgba(124,58,237,0.18)',
  success: '#2e7d32',
  error: '#c0392b',
  shadow: '0 28px 80px rgba(124,58,237,0.14)',
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
  const [errorCode, setErrorCode] = useState('');
  const [notice, setNotice] = useState('');
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pending2fa, setPending2fa] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement | null>(null);

  const initials = useMemo(() => username.trim().charAt(0).toUpperCase() || 'M', [username]);
  const googleClientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ||
    '';
  const appleClientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || '';

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

  useEffect(() => {
    if (!appleClientId || pending2fa) return;
    const existing = document.getElementById('apple-signin-script');
    if (existing) return;
    const script = document.createElement('script');
    script.id = 'apple-signin-script';
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    script.onload = () => {
      try {
        window.AppleID?.auth.init({
          clientId: appleClientId,
          scope: 'name email',
          redirectURI: window.location.origin + '/login',
          usePopup: true,
        });
      } catch {
        /* Apple SDK optional until client id is valid */
      }
    };
    document.body.appendChild(script);
  }, [appleClientId, pending2fa]);

  async function handleAppleSignIn() {
    if (!window.AppleID?.auth) {
      setError(t('auth.appleFailed'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const response = await window.AppleID.auth.signIn();
      const identityToken = response?.authorization?.id_token;
      if (!identityToken) throw new Error(t('auth.appleFailed'));
      const result = await loginWithApple(identityToken);
      if ('requires_2fa' in result) {
        setPending2fa(result.pending_token);
        setNotice(t('security.enter2fa'));
        return;
      }
      router.push(nextPath.startsWith('/') ? nextPath : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.appleFailed'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!googleClientId || pending2fa) return;

    const handleCredential = async (response: { credential?: string }) => {
      const idToken = response.credential;
      if (!idToken) return;
      setError('');
      setLoading(true);
      try {
        const result = await loginWithGoogle(idToken);
        if ('requires_2fa' in result) {
          setPending2fa(result.pending_token);
          setNotice(t('security.enter2fa'));
          return;
        }
        router.push(nextPath.startsWith('/') ? nextPath : '/');
      } catch (err) {
        setError(err instanceof Error ? err.message : t('auth.googleFailed'));
      } finally {
        setLoading(false);
      }
    };

    const renderGoogle = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleCredential,
      });
      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        width: 360,
      });
      setGoogleReady(true);
    };

    const existing = document.getElementById('google-gis-script');
    if (existing) {
      renderGoogle();
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = renderGoogle;
    document.body.appendChild(script);
  }, [googleClientId, pending2fa, nextPath, router, t]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setErrorCode('');
    setLoading(true);
    try {
      if (pending2fa) {
        await loginWith2fa(pending2fa, totpCode);
        router.push(nextPath.startsWith('/') ? nextPath : '/');
        return;
      }
      const result = await login(username.trim(), password);
      if ('requires_2fa' in result) {
        setPending2fa(result.pending_token);
        setNotice(t('security.enter2fa'));
        return;
      }
      router.push(nextPath.startsWith('/') ? nextPath : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
      setErrorCode((err as { code?: string })?.code || '');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    setResending(true);
    setError('');
    try {
      await resendVerificationEmail(username.trim());
      setErrorCode('');
      setNotice(t('auth.verificationResent'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setResending(false);
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
            style={{ background: COLORS.panel, boxShadow: '0 18px 40px rgba(124,58,237,0.14)' }}
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
              <label htmlFor="login-username" className="mb-2 block text-base font-semibold" style={{ color: COLORS.text }}>
                {t('auth.email')}
              </label>
              <div
                className="cosmic-input-group flex items-center gap-3 rounded-2xl border px-4 py-4 transition focus-within:ring-2"
                style={{
                  background: COLORS.input,
                  borderColor: COLORS.inputBorder,
                  color: COLORS.text,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
                }}
              >
                <FiMail className="h-5 w-5 shrink-0" style={{ color: COLORS.muted }} />
                <input
                  id="login-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-transparent text-base outline-none placeholder:text-[#9691B8]"
                  style={{ color: COLORS.text }}
                  placeholder={t('auth.enterEmail')}
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="mb-2 block text-base font-semibold" style={{ color: COLORS.text }}>
                {t('auth.password')}
              </label>
              <div
                className="cosmic-input-group flex items-center gap-3 rounded-2xl border px-4 py-4"
                style={{
                  background: COLORS.input,
                  borderColor: COLORS.inputBorder,
                  color: COLORS.text,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
                }}
              >
                <FiLock className="h-5 w-5 shrink-0" style={{ color: COLORS.muted }} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent text-base outline-none placeholder:text-[#9691B8]"
                  style={{ color: COLORS.text }}
                  placeholder={t('auth.enterPassword')}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="icon-only p-1.5 shrink-0"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? (
                    <FiEyeOff className="h-5 w-5" style={{ color: COLORS.muted }} />
                  ) : (
                    <FiEye className="h-5 w-5" style={{ color: COLORS.muted }} />
                  )}
                </button>
              </div>
            </div>

            {pending2fa && (
              <div>
                <label htmlFor="login-2fa" className="mb-2 block text-base font-semibold" style={{ color: COLORS.text }}>
                  {t('security.enter2fa')}
                </label>
                <input
                  id="login-2fa"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="cosmic-input w-full rounded-2xl border px-4 py-4 text-base"
                  style={{ background: COLORS.input, borderColor: COLORS.inputBorder, color: COLORS.text }}
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>
            )}

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-base font-semibold" style={{ color: COLORS.primary }}>
                {t('auth.forgotPassword')}
              </Link>
            </div>

            {notice && <div className="text-sm" style={{ color: COLORS.success }}>{notice}</div>}
            {error && <div className="text-sm" style={{ color: COLORS.error }}>{error}</div>}
            {errorCode === 'email_not_verified' && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className="text-sm font-semibold underline disabled:opacity-60"
                style={{ color: COLORS.text }}
              >
                {resending ? t('auth.resendingVerification') : t('auth.resendVerification')}
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl py-4 text-lg font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
              style={{ background: `linear-gradient(180deg, ${COLORS.primary}, ${COLORS.primaryDark})` }}
            >
              {loading ? t('auth.signingIn') : pending2fa ? t('security.verify2fa') : t('auth.signIn')}
            </button>
          </form>

          {(googleClientId || appleClientId) && !pending2fa && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1" style={{ background: COLORS.line }} />
                <span className="text-sm" style={{ color: COLORS.muted }}>{t('auth.orContinueWith')}</span>
                <div className="h-px flex-1" style={{ background: COLORS.line }} />
              </div>
              {googleClientId && (
                <div className="flex justify-center">
                  <div ref={googleBtnRef} className={googleReady ? '' : 'min-h-[44px] w-full max-w-[360px]'} />
                </div>
              )}
              {appleClientId && (
                <button
                  type="button"
                  onClick={handleAppleSignIn}
                  disabled={loading}
                  className="w-full rounded-2xl border py-3 text-base font-semibold transition hover:opacity-95 disabled:opacity-60"
                  style={{ borderColor: COLORS.inputBorder, color: COLORS.text, background: COLORS.input }}
                >
                  {t('auth.continueWithApple')}
                </button>
              )}
            </div>
          )}

          <p className="mt-8 text-center text-lg" style={{ color: COLORS.muted }}>
            {t('auth.newToCosonova')}{' '}
            <Link href="/register" className="font-semibold" style={{ color: COLORS.primary }}>
              {t('auth.signUp')}
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