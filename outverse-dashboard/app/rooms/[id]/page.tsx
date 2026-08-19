'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale } from '@/components/LocaleProvider';

/** Deep-link old room URLs into Cosmic Chat. */
export default function RoomThreadRedirectPage() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const roomId = params?.id;

  useEffect(() => {
    if (!roomId) {
      router.replace('/chat?tab=prompt');
      return;
    }
    router.replace(`/chat?tab=prompt&room=${roomId}`);
  }, [router, roomId]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-text-secondary">
      {t('chat.openingRoomInChat')}
    </div>
  );
}
