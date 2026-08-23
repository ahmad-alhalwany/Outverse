'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { HeartIcon, LightBulbIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { apiFetch } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { useLocale } from '@/components/LocaleProvider';
import { bazaarCategoryLabel, type BazaarIdea } from '@/lib/bazaarTypes';
import { formatCount } from '@/lib/profileEmotions';

type IdeasScope = 'owned' | 'collaborating' | 'supporting';

interface ProfileIdeasGridProps {
  userId: string;
  palette: {
    text: string;
    text2: string;
    white: string;
    line: string;
    shadowSm: string;
    card: string;
    card2: string;
    brown: string;
    brownDk: string;
  };
}

export default function ProfileIdeasGrid({ userId, palette: C }: ProfileIdeasGridProps) {
  const { t, locale } = useLocale();
  const authUser = useAuthUser();
  const isOwn = authUser ? String(authUser.id) === String(userId) : false;
  const [scope, setScope] = useState<IdeasScope>('owned');
  const [ideas, setIdeas] = useState<BazaarIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    let path = `ideas/?ordering=new`;
    if (isOwn) {
      if (scope === 'owned') path += '&owner=me';
      else if (scope === 'collaborating') path += '&owner=collaborating';
      else path += '&owner=supporting';
    } else {
      path += `&owner_id=${encodeURIComponent(userId)}`;
    }
    apiFetch(path)
      .then((res) => {
        if (!res.ok) throw new Error('failed');
        return res.json();
      })
      .then((data) => {
        const rows = Array.isArray(data) ? data : data?.results || [];
        setIdeas(rows as BazaarIdea[]);
      })
      .catch(() => {
        setIdeas([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [isOwn, scope, userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="text-center py-12 text-sm" style={{ color: C.text2 }}>
        {t('bazaar.loading')}
      </div>
    );
  }

  return (
    <div>
      {isOwn ? (
        <div
          className="mb-4 flex rounded-xl p-1 gap-0.5 overflow-x-auto"
          style={{ background: C.card2, border: `1px solid ${C.line}` }}
        >
          {(
            [
              { key: 'owned', labelKey: 'bazaar.profileScopeOwned' },
              { key: 'collaborating', labelKey: 'bazaar.profileScopeCollaborating' },
              { key: 'supporting', labelKey: 'bazaar.profileScopeSupporting' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setScope(item.key)}
              className="flex-1 min-w-[6rem] py-2 text-xs font-semibold rounded-lg whitespace-nowrap"
              style={{
                color: scope === item.key ? C.brown : C.text2,
                background: scope === item.key ? C.white : 'transparent',
              }}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: C.text2 }}>
            {t('bazaar.profileLoadError')}
          </p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-4 rounded-full px-6 py-2 text-sm font-semibold"
            style={{ background: C.card, color: C.brown }}
          >
            {t('profile.retry')}
          </button>
        </div>
      ) : ideas.length === 0 ? (
        <div className="text-center py-12">
          <LightBulbIcon className="h-10 w-10 mx-auto mb-3 opacity-60" style={{ color: C.brown }} />
          <p className="text-sm" style={{ color: C.text2 }}>
            {isOwn && scope !== 'owned'
              ? t('bazaar.profileEmptyScoped')
              : t('bazaar.profileEmptyBazaar')}
          </p>
          {isOwn && scope === 'owned' ? (
            <Link
              href="/bazaar"
              className="inline-block mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: C.brownDk }}
            >
              {t('bazaar.createIdea')}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {ideas.map((idea) => (
            <Link
              key={idea.id}
              href={`/bazaar/${idea.id}`}
              className="rounded-xl overflow-hidden block"
              style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
            >
              <div
                className="h-24 bg-cover bg-center"
                style={{
                  background: idea.cover_url
                    ? `url(${idea.cover_url}) center/cover`
                    : `linear-gradient(135deg, ${C.card}, ${C.card2})`,
                }}
              />
              <div className="p-3">
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mb-2"
                  style={{ background: C.card2, color: C.brown }}
                >
                  {bazaarCategoryLabel(idea.category, locale)}
                </span>
                <p className="font-semibold text-sm line-clamp-2" style={{ color: C.text }}>
                  {idea.title}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: C.text2 }}>
                  <span className="inline-flex items-center gap-1">
                    {idea.is_voted ? (
                      <HeartSolid className="h-3.5 w-3.5" style={{ color: C.brown }} />
                    ) : (
                      <HeartIcon className="h-3.5 w-3.5" />
                    )}
                    {formatCount(idea.supporters)}
                  </span>
                  {idea.funding_goal ? (
                    <span>
                      {formatCount(idea.funding_raised)} / {formatCount(idea.funding_goal)} {t('bazaar.coins')}
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
