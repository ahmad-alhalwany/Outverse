'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

/**
 * Standalone web chat (responsive). Not a separate native app — links back to Outverse only.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login?next=/chat');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-sm"
        style={{ background: 'var(--cc-bg, #1a1410)', color: 'var(--cc-text-2, #a89a8e)' }}
      >
        Loading chat…
      </div>
    );
  }

  return (
    <div className="chat-standalone min-h-screen flex flex-col">
      <div
        className="flex items-center justify-between px-3 py-2 border-b text-xs shrink-0"
        style={{
          borderColor: 'var(--cc-border, #3d2e24)',
          background: 'var(--cc-panel, #2a2118)',
          color: 'var(--cc-text-2, #a89a8e)',
        }}
      >
        <Link href="/" className="font-semibold hover:underline" style={{ color: 'var(--cc-text, #f5ebe0)' }}>
          ← Back to Outverse
        </Link>
        <span>Standalone chat</span>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
