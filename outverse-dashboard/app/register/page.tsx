'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LuArrowRight as ArrowRight,
  LuBadgeCheck as CheckCircle2,
  LuEye as Eye,
  LuEyeOff as EyeOff,
  LuHouse as Home,
  LuLock as Lock,
  LuMail as Mail,
  LuMountain as Mountain,
  LuTrees as Trees,
  LuUser as User,
  LuWaves as Waves,
} from 'react-icons/lu';
import type { IconType } from 'react-icons';
import { checkUsernameAvailability, register } from '@/lib/auth';

const QUIZ_OPTIONS = {
  environment: [
    { id: 'ocean', label: 'Ocean', icon: Waves },
    { id: 'mountains', label: 'Mountains', icon: Mountain },
    { id: 'city', label: 'City', icon: Home },
    { id: 'forest', label: 'Forest', icon: Trees },
  ],
  power: [
    { id: 'time-travel', label: 'Time Travel' },
    { id: 'mind-reading', label: 'Mind Reading' },
    { id: 'flying', label: 'Flying' },
    { id: 'invisibility', label: 'Invisibility' },
  ],
} as const;

const STEPS = ['Basic Info', 'Interests', 'Avatar'] as const;

const COLORS = {
  page: '#FFF8F4',
  panel: '#FFFFFF',
  panelSoft: '#FFD9CC',
  panelMuted: '#F8E7E0',
  border: '#F2D7CC',
  borderStrong: '#D9B4A6',
  text: '#2E2320',
  muted: '#6F5A53',
  accent: '#9E5A43',
  accentDark: '#7F4634',
  accentSoft: '#F7CFC2',
  success: '#9E5A43',
  shadow: '0 24px 60px rgba(92, 53, 39, 0.08)',
};

type QuizState = {
  environment: string;
  power: string;
};

function ProgressBar() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm font-medium" style={{ color: COLORS.muted }}>
        {STEPS.map((step) => (
          <span key={step}>{step}</span>
        ))}
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: '#F3ECE8' }}>
        <div className="h-full rounded-full" style={{ width: '33.333%', background: COLORS.text }} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: COLORS.text }}>Step 1 of 3</p>
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-4 w-4 rounded-full border"
              style={{
                borderColor: index === 0 ? COLORS.accent : COLORS.borderStrong,
                background: index === 0 ? COLORS.accent : 'transparent',
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
      className="flex items-center gap-3 rounded-2xl border px-4 py-4 transition focus-within:border-[#9E5A43]"
      style={{ borderColor: COLORS.border, background: COLORS.panel }}
    >
      <Icon size={20} style={{ color: '#8E7A73' }} />
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#9A847C]"
        style={{ color: COLORS.text }}
      />
      {trailing}
    </label>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [quiz, setQuiz] = useState<QuizState>({
    environment: 'ocean',
    power: 'time-travel',
  });

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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!fullName.trim() || !email.trim() || !username.trim() || !password || !confirmPassword) {
      setError('Please complete all fields to continue.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (usernameStatus === 'taken') {
      setError('That username is already taken.');
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
              <ProgressBar />
            </div>

            <form onSubmit={submit} className="mt-8 space-y-8">
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
                      <button type="button" onClick={() => setShowPassword((current) => !current)} className="text-[#8E7A73]">
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
                      <button type="button" onClick={() => setShowConfirmPassword((current) => !current)} className="text-[#8E7A73]">
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

              <section className="rounded-[24px] border p-6 md:p-8" style={{ background: COLORS.panel, borderColor: COLORS.border, boxShadow: COLORS.shadow }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold tracking-[-0.03em]" style={{ color: COLORS.text }}>Quick Personality Quiz</h2>
                    <p className="mt-2 text-lg" style={{ color: COLORS.muted }}>Help us personalize your experience</p>
                  </div>
                  <CheckCircle2 size={28} style={{ color: COLORS.accent }} />
                </div>

                <div className="mt-8">
                  <h3 className="text-2xl font-semibold tracking-[-0.02em]" style={{ color: COLORS.text }}>Pick your favorite environment:</h3>
                  <div className="mt-5 grid grid-cols-2 gap-4">
                    {QUIZ_OPTIONS.environment.map(({ id, label, icon: Icon }) => {
                      const active = quiz.environment === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setQuiz((current) => ({ ...current, environment: id }))}
                          className="rounded-[20px] border p-4 text-left transition hover:-translate-y-0.5"
                          style={{
                            background: COLORS.panelSoft,
                            borderColor: active ? COLORS.accent : COLORS.panelSoft,
                            boxShadow: active ? 'inset 0 0 0 1px #9E5A43' : 'none',
                          }}
                        >
                          <div className="flex h-28 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.2))' }}>
                            <Icon size={42} style={{ color: COLORS.accentDark }} />
                          </div>
                          <p className="mt-4 text-center text-2xl font-semibold" style={{ color: COLORS.accentDark }}>{label}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-2xl font-semibold tracking-[-0.02em]" style={{ color: COLORS.text }}>Choose your superpower:</h3>
                  <div className="mt-5 grid grid-cols-2 gap-4">
                    {QUIZ_OPTIONS.power.map(({ id, label }) => {
                      const active = quiz.power === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setQuiz((current) => ({ ...current, power: id }))}
                          className="rounded-[18px] border px-4 py-5 text-center text-xl font-semibold transition"
                          style={{
                            background: active ? '#F4C8B8' : COLORS.panelSoft,
                            borderColor: active ? COLORS.accent : COLORS.panelSoft,
                            color: COLORS.accentDark,
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                      <p className="mt-4 text-2xl" style={{ color: COLORS.muted }}>Complete step 3 to customize</p>
                    </div>
                  </div>
                </div>
              </section>

              {error && (
                <div className="rounded-2xl border px-4 py-3 text-sm font-medium" style={{ borderColor: '#E8B7A8', background: '#FFF1EC', color: '#A24F39' }}>
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <Link href="/login" className="text-lg font-medium" style={{ color: COLORS.muted }}>
                  Back
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-3 rounded-2xl px-7 py-4 text-lg font-semibold text-white transition disabled:opacity-60"
                  style={{ background: COLORS.accent }}
                >
                  {loading ? 'Creating account...' : 'Continue to Interests'}
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