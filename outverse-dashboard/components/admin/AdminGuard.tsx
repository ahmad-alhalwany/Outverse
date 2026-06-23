'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { checkStaffAccess } from '@/lib/adminApi';
import { isAuthenticated } from '@/lib/auth';

export default function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<'loading' | 'ok' | 'auth' | 'staff'>('loading');

  useEffect(() => {
    if (!isAuthenticated()) {
      setState('auth');
      return;
    }
    checkStaffAccess()
      .then((ok) => setState(ok ? 'ok' : 'staff'))
      .catch(() => setState('staff'));
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
    return (
      <div className="admin-root admin-guard">
        <h2 className="text-xl font-bold">Staff access only</h2>
        <p className="text-text-secondary text-sm max-w-sm">
          Your account is not marked as staff. In Django admin or shell, set{' '}
          <code>is_staff=True</code> for your user.
        </p>
        <Link href="/" className="admin-btn admin-btn--ghost">
          Back to app
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
