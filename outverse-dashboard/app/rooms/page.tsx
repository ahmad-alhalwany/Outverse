'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Prompt rooms now live inside Cosmic Chat. */
export default function RoomsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/chat?tab=prompt');
  }, [router]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-text-secondary">
      Opening prompt rooms in chat…
    </div>
  );
}
