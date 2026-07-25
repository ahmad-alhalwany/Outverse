'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

/** Resolves an @username mention link to the numeric profile route. */
export default function MentionRedirectPage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const username = params?.username;
    if (!username) return;
    let cancelled = false;
    apiFetch(`users/by-username/${encodeURIComponent(username)}/`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        router.replace(`/profile/${data.id}`);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [params?.username, router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-text-secondary text-sm">
      {notFound ? `@${params?.username} was not found.` : 'Loading profile…'}
    </div>
  );
}
