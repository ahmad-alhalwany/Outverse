'use client';

import { useEffect } from 'react';
import { isAuthenticated, refreshSession } from '@/lib/auth';

/** Keeps local user profile in sync with the API (staff flag, avatar, etc.). */
export default function AuthBootstrap() {
  useEffect(() => {
    if (!isAuthenticated()) return;
    refreshSession().catch(() => {
      return;
    });
  }, []);
  return null;
}
