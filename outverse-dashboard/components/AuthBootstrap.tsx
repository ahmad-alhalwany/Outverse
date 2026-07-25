'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated, refreshSession } from '@/lib/auth';
import { initSentry, captureException, setUserContext } from '@/lib/sentry';

const ONBOARDING_EXEMPT_PATHS = ['/onboarding', '/login', '/register', '/privacy', '/terms'];

/** Keeps local user profile in sync with the API (staff flag, avatar, etc.). */
export default function AuthBootstrap() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Activate Sentry as early as possible in the client shell.
    initSentry();
    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      captureException(e.reason instanceof Error ? e.reason : new Error(String(e.reason)));
    };
    const onError = (e: ErrorEvent) => {
      captureException(e.error || new Error(e.message));
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onError);

    if (!isAuthenticated()) return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError);
    };
    refreshSession()
      .then((u) => {
        if (!u) return;
        setUserContext({ id: u.id, username: u.username });
        const exempt = ONBOARDING_EXEMPT_PATHS.some((p) => pathname?.startsWith(p));
        if (u.onboarding_completed === false && !exempt) {
          router.replace('/onboarding');
        }
      })
      .catch(() => { return; });

    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError);
    };
  }, [pathname, router]);
  return null;
}
