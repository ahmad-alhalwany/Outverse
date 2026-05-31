'use client';

import Link from 'next/link';
import { ArrowLeftIcon, HeartIcon, UsersIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { mediaUrl } from '@/lib/api';
import {
  bazaarCategoryLabel,
  bazaarOwnerName,
  type BazaarIdea,
} from '@/lib/bazaarTypes';

const PALETTES = {
  light: {
    cream: '#FBF3EE',
    card: '#F5E4DB',
    card2: '#F9ECE4',
    white: '#FFFFFF',
    brown: '#A0563B',
    brownDk: '#854330',
    text: '#3D2B22',
    text2: '#9A8278',
    line: 'rgba(160,86,59,0.14)',
    progressBg: 'rgba(0,0,0,0.06)',
    fundedBg: '#e8f3ee',
    fundedText: '#2f8f6b',
    btnShadow: '0 6px 20px rgba(160,86,59,0.3)',
  },
  dark: {
    cream: '#1a1a2e',
    card: '#23234a',
    card2: '#2d1b4a',
    white: '#2a2a45',
    brown: '#c49a6c',
    brownDk: '#a0563b',
    text: '#F5F6FA',
    text2: '#B3B3B3',
    line: 'rgba(106,0,255,0.18)',
    progressBg: 'rgba(255,255,255,0.08)',
    fundedBg: 'rgba(74,222,128,0.15)',
    fundedText: '#4ade80',
    btnShadow: '0 6px 20px rgba(106,0,255,0.25)',
  },
};

type Props = {
  idea: BazaarIdea;
  voted: boolean;
  onVote: () => void;
};

export default function IdeaDetailView({ idea, voted, onVote }: Props) {
  const { theme } = useTheme();
  const { t, locale } = useLocale();
  const C = PALETTES[theme];
  const pct = idea.funding_goal
    ? Math.min(100, Math.round((idea.funding_raised / idea.funding_goal) * 100))
    : null;
  const ownerName = bazaarOwnerName(idea);

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/bazaar"
        className="inline-flex items-center gap-2 text-sm font-medium mb-4 hover:opacity-80"
        style={{ color: C.text2 }}
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {t('bazaar.backToBazaar')}
      </Link>

      <article
        className="rounded-2xl overflow-hidden"
        style={{ background: C.white, border: `1px solid ${C.line}` }}
      >
        <div
          className="h-48 sm:h-56 bg-cover bg-center"
          style={{
            background: idea.cover_url
              ? `url(${idea.cover_url}) center/cover`
              : `linear-gradient(135deg, ${C.card}, ${C.card2})`,
          }}
        />
        <div className="p-5 sm:p-6">
          <span
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: C.card2, color: C.brown }}
          >
            {bazaarCategoryLabel(idea.category, locale)}
          </span>
          {idea.status !== 'proposed' && (
            <span
              className="ms-2 px-2.5 py-1 rounded-full text-xs"
              style={{ background: C.fundedBg, color: C.fundedText }}
            >
              {idea.status === 'in_progress'
                ? t('bazaar.inProgress')
                : t('bazaar.completed')}
            </span>
          )}
          <h1 className="text-2xl font-bold mt-3" style={{ color: C.text }}>
            {idea.title}
          </h1>
          <p
            className="text-sm mt-3 leading-relaxed whitespace-pre-wrap"
            style={{ color: C.text2 }}
          >
            {idea.description}
          </p>
          {pct != null && (
            <div className="mt-4">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: C.progressBg }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.brown }} />
              </div>
              <p className="text-xs mt-1" style={{ color: C.text2 }}>
                ${idea.funding_raised.toLocaleString()} {t('bazaar.raised')} · $
                {idea.funding_goal?.toLocaleString()} {t('bazaar.goal')}
              </p>
            </div>
          )}
          {idea.roles_needed?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {idea.roles_needed.map((r) => (
                <span
                  key={r}
                  className="px-2 py-1 rounded-md text-xs"
                  style={{ background: C.card2, color: C.text }}
                >
                  {r}
                </span>
              ))}
            </div>
          )}
          <div
            className="flex items-center justify-between mt-5 pt-4 border-t"
            style={{ borderColor: C.line }}
          >
            {idea.owner?.id ? (
              <Link
                href={`/profile/${idea.owner.id}`}
                className="text-sm font-medium hover:underline"
                style={{ color: C.brown }}
              >
                {ownerName}
              </Link>
            ) : (
              <span className="text-sm" style={{ color: C.text2 }}>
                {ownerName}
              </span>
            )}
            <span className="text-xs flex items-center gap-1" style={{ color: C.text2 }}>
              <UsersIcon className="h-4 w-4" />
              {idea.collaborators_count} {t('bazaar.collaborators')}
            </span>
          </div>
          <button
            type="button"
            onClick={onVote}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white"
            style={{
              background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`,
              boxShadow: C.btnShadow,
            }}
          >
            {voted ? <HeartSolid className="h-5 w-5" /> : <HeartIcon className="h-5 w-5" />}
            {voted ? t('bazaar.supported') : t('bazaar.supportIdea')}
          </button>
          <p className="text-center text-xs mt-2" style={{ color: C.text2 }}>
            {idea.supporters} {t('bazaar.supporters')}
          </p>
        </div>
      </article>
    </div>
  );
}
