'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LuArrowRight as ArrowRight,
  LuEye as Eye,
  LuEyeOff as EyeOff,
  LuLock as Lock,
  LuMail as Mail,
  LuUser as User,
} from 'react-icons/lu';
import type { IconType } from 'react-icons';
import { checkUsernameAvailability, register } from '@/lib/auth';
import { useLocale } from '@/components/LocaleProvider';

const STEPS = ['Basic Info', 'Avatar'] as const;

const COLORS = {
  page: '#F3F0FC',
  panel: '#FFFFFF',
  panelSoft: '#DCC9FA',
  panelMuted: '#F5F1FE',
  border: '#E3D9F7',
  borderStrong: '#C4B5FD',
  text: '#211B3D',
  muted: '#79709E',
  accent: '#7C3AED',
  accentDark: '#5B21B6',
  accentSoft: '#EDE4FB',
  success: '#7C3AED',
  shadow: '0 24px 60px rgba(33, 27, 61, 0.10)',
};

function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm font-medium" style={{ color: COLORS.muted }}>
        {STEPS.map((step, index) => (
          <span key={step} style={{ color: index === currentStep ? COLORS.text : COLORS.muted, fontWeight: index === currentStep ? 700 : 500 }}>
            {step}
          </span>
        ))}
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: '#F3ECE8' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%`, background: COLORS.text }}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: COLORS.text }}>Step {currentStep + 1} of {STEPS.length}</p>
        <div className="flex items-center gap-2">
          {STEPS.map((_, index) => (
            <span
              key={index}
              className="h-4 w-4 rounded-full border"
              style={{
                borderColor: index <= currentStep ? COLORS.accent : COLORS.borderStrong,
                background: index <= currentStep ? COLORS.accent : 'transparent',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  type = 'text',
  placeholder,
  value,
  onChange,
  autoComplete,
  trailing,
}: {
  icon: IconType;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  trailing?: ReactNode;
}) {
  return (
    <label
      className="flex items-center gap-3 rounded-2xl border px-4 py-4 transition focus-within:border-[#7C3AED]"
      style={{ borderColor: COLORS.border, background: COLORS.panel }}
    >
      <Icon size={20} style={{ color: '#79709E' }} />
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete={autoComplete}
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#9691B8]"
        style={{ color: COLORS.text }}
      />
      {trailing}
    </label>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { t, dir } = useLocale();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [step, setStep] = useState(0);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  useEffect(() => {
    if (!username.trim()) {
      setUsernameStatus('idle');
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        setUsernameStatus('checking');
        const available = await checkUsernameAvailability(username.trim());
        setUsernameStatus(available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 350);
    return () => window.clearTimeout(handle);
  }, [username]);

  const firstName = useMemo(() => fullName.trim().split(/\s+/).filter(Boolean)[0] ?? '', [fullName]);
  const lastName = useMemo(() => fullName.trim().split(/\s+/).filter(Boolean).slice(1).join(' '), [fullName]);

  function validateBasicInfo(): string | null {
    if (!fullName.trim() || !email.trim() || !username.trim() || !password || !confirmPassword) {
      return 'Please complete all fields to continue.';
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters.';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }
    if (usernameStatus === 'taken') {
      return 'That username is already taken.';
    }
    return null;
  }

  function goNext() {
    if (step === 0) {
      const validationError = validateBasicInfo();
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    setError('');
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    setError('');
    setStep((current) => Math.max(current - 1, 0));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (step < STEPS.length - 1) {
      goNext();
      return;
    }
    const validationError = validateBasicInfo();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!agreed) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        first_name: firstName,
        last_name: lastName,
      });
      router.push('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8 md:px-6 md:py-12" style={{ background: COLORS.page }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-[980px]"
      >
        <div className="rounded-[32px] border px-5 py-6 md:px-10 md:py-10" style={{ background: COLORS.page, borderColor: 'transparent' }}>
          <div className="mx-auto max-w-[780px]">
            <h1 className="text-center text-4xl font-bold tracking-[-0.03em] md:text-6xl" style={{ color: COLORS.text }}>
              Join the Community
            </h1>
            <div className="mt-8">
              <ProgressBar currentStep={step} />
            </div>

            <form onSubmit={submit} className="mt-8 space-y-8">
              {step === 0 && (
                <section className="rounded-[24px] border p-6 md:p-8" style={{ background: COLORS.panel, borderColor: COLORS.border, boxShadow: COLORS.shadow }}>
                  <h2 className="text-3xl font-bold tracking-[-0.03em]" style={{ color: COLORS.text }}>Basic Information</h2>
                  <div className="mt-6 grid gap-4">
                    <Field icon={User} placeholder="Enter your name" value={fullName} onChange={setFullName} autoComplete="name" />
                    <Field icon={Mail} placeholder="your@email.com" value={email} onChange={setEmail} autoComplete="email" type="email" />
                    <Field icon={User} placeholder="Choose a username" value={username} onChange={setUsername} autoComplete="username" />
                    <Field
                      icon={Lock}
                      placeholder="Create a password"
                      value={password}
                      onChange={setPassword}
                      autoComplete="new-password"
                      type={showPassword ? 'text' : 'password'}
                      trailing={
                        <button type="button" onClick={() => setShowPassword((current) => !current)} className="text-[#79709E]">
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      }
                    />
                    <Field
                      icon={Lock}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      autoComplete="new-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      trailing={
                        <button type="button" onClick={() => setShowConfirmPassword((current) => !current)} className="text-[#79709E]">
                          {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      }
                    />
                  </div>
                  {usernameStatus !== 'idle' && (
                    <p className="mt-4 text-sm font-medium" style={{ color: usernameStatus === 'taken' ? '#B4533D' : COLORS.success }}>
                      {usernameStatus === 'checking'
                        ? 'Checking username availability...'
                        : usernameStatus === 'available'
                          ? 'Username is available.'
                          : 'Username is already taken.'}
                    </p>
                  )}
                </section>
              )}

              {step === 1 && (
                <section className="rounded-[24px] border p-6 md:p-8" style={{ background: COLORS.panel, borderColor: COLORS.border, boxShadow: COLORS.shadow }}>
                  <h2 className="text-3xl font-bold tracking-[-0.03em]" style={{ color: COLORS.text }}>Your Avatar</h2>
                  <p className="mt-2 text-lg" style={{ color: COLORS.muted }}>You&apos;ll fully customize this in the next step</p>
                  <div className="mt-8 rounded-[20px] p-5" style={{ background: COLORS.panelSoft }}>
                    <p className="text-2xl font-semibold" style={{ color: COLORS.accentDark }}>Your Future Avatar</p>
                    <div
                      className="mt-4 flex min-h-[180px] items-center justify-center rounded-[20px] border-2 border-dashed px-6 py-10 text-center"
                      style={{ borderColor: COLORS.borderStrong, background: COLORS.panel }}
                    >
                      <div>
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: COLORS.panelMuted }}>
                          <User size={28} style={{ color: COLORS.accentDark }} />
                        </div>
                        <p className="mt-4 text-2xl" style={{ color: COLORS.muted }}>Customize your avatar and accessories after signup</p>
                      </div>
                    </div>
                  </div>

                  <label
                    className="mt-6 flex items-start gap-3 rounded-2xl border p-4 text-sm"
                    style={{ borderColor: COLORS.border, background: COLORS.panelSoft, color: COLORS.text, direction: dir }}
                  >
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                      style={{ accentColor: COLORS.accent }}
                    />
                    <span>
                      {t('legal.agreeTerms')}{' '}
                      <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: COLORS.accent }}>
                        {t('legal.termsTitle')}
                      </Link>{' '}
                      &{' '}
                      <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: COLORS.accent }}>
                        {t('legal.privacyTitle')}
                      </Link>
                    </span>
                  </label>
                </section>
              )}

              {error && (
                <div className="rounded-2xl border px-4 py-3 text-sm font-medium" style={{ borderColor: '#E8B7A8', background: '#FFF1EC', color: '#A24F39' }}>
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                {step === 0 ? (
                  <Link href="/login" className="text-lg font-medium" style={{ color: COLORS.muted }}>
                    Back
                  </Link>
                ) : (
                  <button type="button" onClick={goBack} className="text-lg font-medium" style={{ color: COLORS.muted }}>
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-3 rounded-2xl px-7 py-4 text-lg font-semibold text-white transition disabled:opacity-60"
                  style={{ background: COLORS.accent }}
                >
                  {loading
                    ? 'Creating account...'
                    : step === 0
                      ? 'Continue to Avatar'
                      : 'Create Account'}
                  <ArrowRight size={20} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
}