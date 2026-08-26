'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { useLocale } from '@/components/LocaleProvider';

/**
 * Standalone web chat (responsive). Not a separate native app — links back to Cosonova only.
 * Height is locked to the viewport so the message composer stays visible.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
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
        className="h-dvh max-h-dvh flex items-center justify-center text-sm overflow-hidden"
        style={{ background: 'var(--cc-cream, #F3F0FC)', color: 'var(--cc-text-2, #79709E)' }}
      >
        {t('chat.loadingChat')}
      </div>
    );
  }

  return (
    <div className="chat-standalone h-dvh max-h-dvh overflow-hidden flex flex-col">
      <div
        className="flex items-center justify-between px-3 py-2 border-b text-xs shrink-0"
        style={{
          borderColor: 'var(--cc-line, rgba(124, 58, 237, 0.16))',
          background: 'var(--cc-panel, #E9E1FA)',
          color: 'var(--cc-text-2, #79709E)',
        }}
      >
        <Link href="/" className="font-semibold hover:underline" style={{ color: 'var(--cc-text, #211B3D)' }}>
          {t('chat.backToCosonova')}
        </Link>
        <span>{t('chat.standaloneChat')}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
