'use client';

import { useEffect, useState } from 'react';
import { getUser, type AuthUser } from '@/lib/auth';

/** Auth from localStorage — null on server and first client paint (hydration-safe). */
export function useAuthUser(): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getUser());
    const onUpdate = () => setUser(getUser());
    window.addEventListener('cosmory:user-updated', onUpdate);
    return () => window.removeEventListener('cosmory:user-updated', onUpdate);
  }, []);

  return user;
}

/** Profile link stable for SSR; updates after mount when logged in. */
export function useProfileHref(fallback = '/login'): string {
  const [href, setHref] = useState(fallback);

  useEffect(() => {
    const id = getUser()?.id;
    setHref(id ? `/profile/${id}` : fallback);
  }, [fallback]);

  return href;
}
