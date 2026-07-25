'use client';

import { useEffect, useMemo, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { TrophyIcon, ShareIcon, FlagIcon, LightBulbIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import { TrophyIcon as TrophySolid } from '@heroicons/react/24/solid';
import WorldPassportStamps from '@/components/achievements/WorldPassportStamps';
import { fetchWorldPassports } from '@/lib/differentiatorApi';
import type { WorldPassport } from '@/lib/differentiatorApi';

const PALETTES = {
  light: {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    progressBg: 'rgba(124,58,237,0.12)',
    lockedIcon: '#C3BCE0',
  },
  dark: {
    cream: '#14102A',
    card: '#1E1740',
    card2: '#251B4D',
    white: '#2A2154',
    brown: '#C4B5FD',
    brownDk: '#A78BFA',
    text: '#F5F3FF',
    text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
    progressBg: 'rgba(255,255,255,0.08)',
    lockedIcon: '#4A4570',
  },
} as const;

type Achievement = {
  title?: string;
  category?: string;
  completed?: boolean;
  progress?: number;
  goal?: number;
};

const CATEGORY_ORDER = ['Challenges', 'Ideas', 'Stories'] as const;

const CATEGORY_ICON: Record<string, typeof FlagIcon> = {
  Challenges: FlagIcon,
  Ideas: LightBulbIcon,
  Stories: BookOpenIcon,
};

function isUnlocked(a: Achievement) {
  const goal = a.goal ?? 0;
  const progress = a.progress ?? 0;
  return Boolean(a.completed) || (goal > 0 && progress >= goal);
}

export default function AchievementsPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const user = useAuthUser();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [shared, setShared] = useState<string | null>(null);
  const [shareFailed, setShareFailed] = useState<string | null>(null);
  const [passport, setPassport] = useState<WorldPassport | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void fetchWorldPassports().then(setPassport);
    apiFetch(`users/${user.id}/`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setAchievements(Array.isArray(data?.achievements) ? data.achievements : []))
      .catch(() => setAchievements([]))
      .finally(() => setLoading(false));
  }, [user]);

  const total = achievements.length;
  const unlocked = achievements.filter(isUnlocked).length;
  const remaining = Math.max(0, total - unlocked);

  const byCategory = useMemo(() => {
    const groups: Record<string, Achievement[]> = {};
    for (const achievement of achievements) {
      const category = achievement.category || 'Challenges';
      groups[category] = groups[category] || [];
      groups[category].push(achievement);
    }
    return groups;
  }, [achievements]);

  const categories = useMemo(() => {
    const known = CATEGORY_ORDER.filter((c) => byCategory[c]?.length);
    const extra = Object.keys(byCategory).filter((c) => !CATEGORY_ORDER.includes(c as (typeof CATEGORY_ORDER)[number]));
    return [...known, ...extra];
  }, [byCategory]);

  async function shareAchievement(achievement: Achievement) {
    const text = `${achievement.title} — ${t('achievements.shareText')}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: achievement.title, text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('sharing unsupported');
      }
      setShared(achievement.title || null);
      window.setTimeout(() => setShared(null), 2200);
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return; // user cancelled, not a failure
      setShareFailed(achievement.title || null);
      window.setTimeout(() => setShareFailed(null), 2200);
    }
  }

  return (
    <WorldShell colors={C}>
      <div className="mx-auto max-w-5xl pt-6">
        <div className="flex items-center gap-3 mb-2">
          <TrophySolid className="h-8 w-8" style={{ color: C.brown }} />
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: C.brown }}>
            {t('achievements.title')}
          </h1>
        </div>
        <p className="text-sm mb-6" style={{ color: C.text2 }}>
          {t('achievements.subtitle')}
        </p>

        {passport ? <WorldPassportStamps passport={passport} /> : null}

        {!user ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>
            {t('achievements.signInPrompt')}
          </div>
        ) : loading ? (
          <div className="py-16 text-center" style={{ color: C.text2 }}>
            {t('common.loading')}
          </div>
        ) : total === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>
            {t('achievements.empty')}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { label: t('achievements.total'), value: total },
                { label: t('achievements.unlocked'), value: unlocked },
                { label: t('achievements.remaining'), value: remaining },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl p-4 text-center"
                  style={{ background: C.white, border: `1px solid ${C.line}` }}
                >
                  <div className="text-2xl font-bold" style={{ color: C.brown }}>{stat.value}</div>
                  <div className="text-xs mt-1" style={{ color: C.text2 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {categories.map((category) => {
              const CategoryIcon = CATEGORY_ICON[category] || TrophyIcon;
              return (
                <section key={category} className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <CategoryIcon className="h-5 w-5" style={{ color: C.brown }} />
                    <h2 className="text-lg font-semibold" style={{ color: C.text }}>{category}</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {byCategory[category].map((achievement, index) => {
                      const goal = achievement.goal ?? 0;
                      const progress = achievement.progress ?? 0;
                      const pct = goal ? Math.min(100, Math.round((progress / goal) * 100)) : 0;
                      const unlockedBadge = isUnlocked(achievement);
                      return (
                        <div
                          key={`${category}-${index}`}
                          className="rounded-2xl p-4 flex flex-col items-center text-center"
                          style={{ background: C.white, border: `1px solid ${C.line}` }}
                        >
                          <div
                            className="flex h-14 w-14 items-center justify-center rounded-full mb-2"
                            style={{ background: unlockedBadge ? C.card : C.progressBg }}
                          >
                            <TrophyIcon
                              className="h-7 w-7"
                              style={{ color: unlockedBadge ? C.brown : C.lockedIcon }}
                            />
                          </div>
                          <p className="text-sm font-semibold" style={{ color: C.text }}>
                            {achievement.title}
                          </p>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: C.progressBg }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.brown }} />
                          </div>
                          <p className="mt-1 text-xs" style={{ color: C.text2 }}>
                            {progress}/{goal}
                          </p>
                          {unlockedBadge && (
                            <button
                              type="button"
                              onClick={() => void shareAchievement(achievement)}
                              className="mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
                              style={{ background: C.card2, color: C.brownDk }}
                            >
                              <ShareIcon className="h-3.5 w-3.5" />
                              {shared === achievement.title
                                ? t('achievements.shared')
                                : shareFailed === achievement.title
                                  ? t('achievements.shareFailed')
                                  : t('achievements.share')}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            <p className="text-center text-sm py-6" style={{ color: C.text2 }}>
              {t('achievements.completeMorePrompt')}
            </p>
          </>
        )}
      </div>
    </WorldShell>
  );
}
