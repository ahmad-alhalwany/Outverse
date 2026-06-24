'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { checkStaffAccess } from '@/lib/adminApi';
import { getUser, isAuthenticated, logout, refreshSession } from '@/lib/auth';

export default function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<'loading' | 'ok' | 'auth' | 'staff'>('loading');
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      if (!isAuthenticated()) {
        if (!cancelled) setState('auth');
        return;
      }

      const refreshed = await refreshSession();
      if (cancelled) return;

      if (!refreshed) {
        setState('auth');
        return;
      }

      setUsername(refreshed.username);

      if (refreshed.is_staff) {
        setState('ok');
        return;
      }

      const access = await checkStaffAccess();
      if (cancelled) return;

      if (access === 'ok') {
        setState('ok');
      } else if (access === 'auth') {
        setState('auth');
      } else {
        setState('staff');
      }
    }

    verify().catch(() => {
      if (!cancelled) setState('auth');
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (state === 'loading') {
    return (
      <div className="admin-root admin-guard">
        <div className="w-10 h-10 rounded-full border-2 border-vault border-t-transparent animate-spin" />
        <p className="text-text-secondary text-sm">Verifying admin access…</p>
      </div>
    );
  }

  if (state === 'auth') {
    return (
      <div className="admin-root admin-guard">
        <h2 className="text-xl font-bold">Sign in required</h2>
        <p className="text-text-secondary text-sm max-w-sm">
          Admin tools require a staff account. Log in with a Django staff user.
        </p>
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={() => router.push(`/login?next=${encodeURIComponent(pathname || '/admin')}`)}
        >
          Go to login
        </button>
      </div>
    );
  }

  if (state === 'staff') {
    const who = username || getUser()?.username;
    return (
      <div className="admin-root admin-guard">
        <h2 className="text-xl font-bold">Staff access only</h2>
        <p className="text-text-secondary text-sm max-w-sm">
          {who ? (
            <>
              Signed in as <strong className="text-text">{who}</strong> — this account is not staff.
              Log in with a staff user (e.g. after{' '}
              <code>python manage.py ensure_staff USERNAME</code>).
            </>
          ) : (
            <>
              Your account is not marked as staff. In Django admin or shell, set{' '}
              <code>is_staff=True</code> for your user.
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={async () => {
              await logout();
              router.push(`/login?next=${encodeURIComponent(pathname || '/admin')}`);
            }}
          >
            Sign out & log in as staff
          </button>
          <Link href="/" className="admin-btn admin-btn--ghost">
            Back to app
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
