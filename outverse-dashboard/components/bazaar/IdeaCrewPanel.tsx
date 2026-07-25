'use client';

import Link from 'next/link';
import { UsersIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import type { IdeaCrew } from '@/lib/differentiatorApi';

const PALETTES = {
  light: { card: '#F5F1FE', text: '#211B3D', text2: '#79709E', line: 'rgba(124,58,237,0.16)', accent: '#7C3AED', done: '#2f8f6b' },
  dark: { card: '#251B4D', text: '#F5F3FF', text2: '#B0A6D9', line: 'rgba(167,139,250,0.20)', accent: '#C4B5FD', done: '#4ade80' },
};

export default function IdeaCrewPanel({ crew }: { crew: IdeaCrew }) {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];

  if (!crew.collab_project_id) return null;

  return (
    <section className="rounded-2xl p-5 mt-6" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <UsersIcon className="h-5 w-5" style={{ color: C.accent }} />
          <h2 className="text-base font-semibold" style={{ color: C.text }}>
            {t('bazaar.crewTitle')}
          </h2>
        </div>
        <div className="flex gap-2">
          {crew.chat_room_id ? (
            <Link href={`/rooms/${crew.chat_room_id}`} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: C.accent }}>
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              {t('bazaar.crewChat')}
            </Link>
          ) : null}
          {crew.collab_url ? (
            <Link href={crew.collab_url} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ border: `1px solid ${C.line}`, color: C.text }}>
              {t('bazaar.crewProject')}
            </Link>
          ) : null}
        </div>
      </div>

      <p className="text-sm mb-4" style={{ color: C.text2 }}>
        {t('bazaar.crewPledges')
          .replace('{count}', String(crew.pledges.count))
          .replace('{amount}', String(crew.pledges.total_amount))}
        {crew.pledges.anonymous_count > 0
          ? ` · ${t('bazaar.crewAnonymous').replace('{n}', String(crew.pledges.anonymous_count))}`
          : ''}
      </p>

      {crew.members.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.text2 }}>
            {t('bazaar.crewMembers')}
          </p>
          <div className="flex flex-wrap gap-2">
            {crew.members.map((m) => (
              <Link
                key={m.id}
                href={`/profile/${m.id}`}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.06)', color: C.text }}
              >
                {m.username || m.first_name || 'Member'}
                {m.role ? ` · ${m.role}` : ''}
              </Link>
            ))}
          </div>
        </div>
      )}

      {(crew.milestones.length > 0 || crew.tasks.length > 0) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.text2 }}>
            {t('bazaar.crewMilestones')}
          </p>
          <ul className="space-y-2">
            {crew.milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm" style={{ color: m.done ? C.done : C.text }}>
                <span>{m.done ? '✓' : '○'}</span>
                <span>{m.title}</span>
              </li>
            ))}
            {crew.tasks.map((task) => (
              <li key={`task-${task.id}`} className="flex items-center gap-2 text-sm" style={{ color: task.status === 'done' ? C.done : C.text }}>
                <span>{task.status === 'done' ? '✓' : '○'}</span>
                <span>{task.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
