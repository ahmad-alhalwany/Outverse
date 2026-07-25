'use client';

import Link from 'next/link';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import type { RelayUser } from '@/lib/differentiatorApi';

const PALETTES = {
  light: { card: '#E9E1FA', text: '#211B3D', text2: '#79709E', line: 'rgba(124,58,237,0.16)', accent: '#7C3AED' },
  dark: { card: '#1E1740', text: '#F5F3FF', text2: '#B0A6D9', line: 'rgba(167,139,250,0.20)', accent: '#C4B5FD' },
};

export default function InspirationRelayList({ users }: { users: RelayUser[] }) {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];

  if (users.length === 0) return null;

  return (
    <section className="rounded-2xl p-4 mt-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <h3 className="text-sm font-semibold mb-2" style={{ color: C.text }}>
        {t('lab.relayTitle')}
      </h3>
      <p className="text-xs mb-3" style={{ color: C.text2 }}>
        {t('lab.relayHint')}
      </p>
      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id}>
            <Link href={`/profile/${u.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:opacity-90" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {u.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: C.line, color: C.text }}>
                  {(u.name || u.username || '?')[0]?.toUpperCase()}
                </span>
              )}
              <div>
                <p className="text-sm font-medium" style={{ color: C.text }}>{u.name || u.username}</p>
                {u.overlap?.length ? (
                  <p className="text-xs" style={{ color: C.text2 }}>
                    {u.overlap.slice(0, 3).join(' · ')}
                  </p>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
