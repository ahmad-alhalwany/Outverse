'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { login } from '@/lib/auth';

const C = {
  cream: '#FBF3EE',
  card: '#F5E4DB',
  white: '#FFFFFF',
  brown: '#A0563B',
  brownDk: '#854330',
  text: '#3D2B22',
  text2: '#9A8278',
  line: 'rgba(160,86,59,0.14)',
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.push(nextPath.startsWith('/') ? nextPath : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  const field = { background: C.white, border: `1px solid ${C.line}`, color: C.text } as const;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: C.cream }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl p-8"
        style={{ background: C.white, boxShadow: '0 20px 60px rgba(61,43,34,0.12)', border: `1px solid ${C.line}` }}
      >
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🌌</div>
          <h1 className="text-2xl font-bold" style={{ color: C.brown }}>Welcome back</h1>
          <p className="text-sm mt-1" style={{ color: C.text2 }}>Sign in to your Outverse</p>
        </div>

        <form onSubmit={submit}>
          <label className="text-sm font-medium" style={{ color: C.text2 }}>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field} placeholder="your_username" autoComplete="username" />

          <label className="text-sm font-medium" style={{ color: C.text2 }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field} placeholder="••••••••" autoComplete="current-password" />

          {error && <div className="text-sm mt-3" style={{ color: '#c0392b' }}>{error}</div>}

          <button type="submit" disabled={loading} className="mt-5 w-full rounded-xl py-3 font-semibold text-white disabled:opacity-60" style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-sm text-center mt-5" style={{ color: C.text2 }}>
          New to Outverse?{' '}
          <a href="/register" className="font-semibold" style={{ color: C.brown }}>Create an account</a>
        </p>
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
