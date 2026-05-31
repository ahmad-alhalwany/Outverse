'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { register } from '@/lib/auth';

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

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Username and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register({ username: username.trim(), email: email.trim(), password });
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
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
          <div className="text-3xl mb-2">🪐</div>
          <h1 className="text-2xl font-bold" style={{ color: C.brown }}>Join Outverse</h1>
          <p className="text-sm mt-1" style={{ color: C.text2 }}>Create your corner of the universe</p>
        </div>

        <form onSubmit={submit}>
          <label className="text-sm font-medium" style={{ color: C.text2 }}>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field} placeholder="pick_a_username" autoComplete="username" />

          <label className="text-sm font-medium" style={{ color: C.text2 }}>Email <span className="opacity-60">(optional)</span></label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field} placeholder="you@example.com" autoComplete="email" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium" style={{ color: C.text2 }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field} placeholder="••••••••" autoComplete="new-password" />
            </div>
            <div>
              <label className="text-sm font-medium" style={{ color: C.text2 }}>Confirm</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field} placeholder="••••••••" autoComplete="new-password" />
            </div>
          </div>

          {error && <div className="text-sm mt-3" style={{ color: '#c0392b' }}>{error}</div>}

          <button type="submit" disabled={loading} className="mt-5 w-full rounded-xl py-3 font-semibold text-white disabled:opacity-60" style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-sm text-center mt-5" style={{ color: C.text2 }}>
          Already have an account?{' '}
          <a href="/login" className="font-semibold" style={{ color: C.brown }}>Sign in</a>
        </p>
      </motion.div>
    </div>
  );
}
