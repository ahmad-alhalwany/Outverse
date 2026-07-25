'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { fetchYearInReview, type YearInReview } from '@/lib/yearApi';

const LIGHT = {
  page: '#F3F0FC',
  card: '#FFFFFF',
  text: '#211B3D',
  muted: '#79709E',
  accent: '#7C3AED',
  border: '#E3D9F7',
  chipBg: '#E9E1FA',
  gold: '#C9974F',
};
const DARK = {
  page: '#14102A',
  card: '#1E1740',
  text: '#F5F3FF',
  muted: '#B0A6D9',
  accent: '#C4B5FD',
  border: 'rgba(255,255,255,0.08)',
  chipBg: 'rgba(255,255,255,0.06)',
  gold: '#E8C887',
};

export default function YearPage() {
  const { theme } = useTheme();
  const { t, dir } = useLocale();
  const C = useMemo(() => (theme === 'dark' ? DARK : LIGHT), [theme]);
  const me = useAuthUser();
  const isAuthed = !!me;

  const [data, setData] = useState<YearInReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthed) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchYearInReview()
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError('Could not load your year.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthed]);

  return (
    <div
      dir={dir}
      className="mx-auto max-w-3xl px-4 py-6 md:py-10"
      style={{ background: C.page, minHeight: '100vh' }}
    >
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium mb-6"
        style={{ color: C.muted }}
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {t('common.back')}
      </Link>

      <header className="mb-8 text-center">
        <div
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3"
          style={{ background: C.chipBg, color: C.accent }}
        >
          <SparklesIcon className="h-3.5 w-3.5" />
          Cosmory
        </div>
        <h1
          className="text-3xl md:text-5xl font-bold leading-tight"
          style={{ color: C.text }}
        >
          {data ? `${data.display_name}'s` : 'Your'} {data?.year ?? new Date().getFullYear()}
        </h1>
        <p className="mt-2 text-sm md:text-base" style={{ color: C.muted }}>
          {t('year.subtitle')}
        </p>
      </header>

      {!isAuthed ? (
        <div
          className="rounded-2xl border p-6 text-center text-sm"
          style={{ borderColor: C.border, background: C.card, color: C.muted }}
        >
          {t('year.needsAuth')}
        </div>
      ) : loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border h-28 animate-pulse"
              style={{ borderColor: C.border, background: C.card }}
            />
          ))}
        </div>
      ) : error ? (
        <div
          className="rounded-2xl border p-6 text-center text-sm"
          style={{ borderColor: C.border, background: C.card, color: C.muted }}
        >
          {error}
        </div>
      ) : data ? (
        <YearRecapView data={data} C={C} />
      ) : null}
    </div>
  );
}

function YearRecapView({ data, C }: { data: YearInReview; C: typeof LIGHT }) {
  const hasContent =
    data.posts_count > 0 ||
    data.capsules_created > 0 ||
    data.ritual_days > 0 ||
    data.rooms_joined > 0;

  if (!hasContent) {
    return (
      <div
        className="rounded-2xl border p-8 text-center"
        style={{ borderColor: C.border, background: C.card }}
      >
        <p className="text-base font-semibold" style={{ color: C.text }}>
          {data.year} hasn&apos;t been written yet.
        </p>
        <p className="mt-2 text-sm" style={{ color: C.muted }}>
          Post a thought, open a capsule, or join a room — and your year will start to take shape.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero stat — words written */}
      <HeroCard
        value={data.words_written.toLocaleString()}
        label={'words written'}
        accent={C.gold}
        C={C}
      />

      <div className="grid grid-cols-2 gap-4">
        <StatCard value={data.posts_count} label={'posts'} C={C} />
        <StatCard value={data.ritual_days} label={'ritual days'} C={C} />
        <StatCard value={data.ritual_max_streak} label={'longest streak'} C={C} />
        <StatCard value={data.voice_notes} label={'voice notes'} C={C} />
        <StatCard value={data.capsules_created} label={'capsules sealed'} C={C} />
        <StatCard value={data.capsules_opened} label={'capsules opened'} C={C} />
        <StatCard value={data.rooms_joined} label={'rooms joined'} C={C} />
        <StatCard value={data.longest_post_chars} label={'longest post (chars)'} C={C} />
      </div>

      {/* First post of the year */}
      {data.first_post && (
        <div
          className="rounded-2xl border p-5"
          style={{ borderColor: C.border, background: C.card }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-widest mb-2"
            style={{ color: C.muted }}
          >
            How your year began
          </p>
          <p
            className="text-sm md:text-base leading-relaxed italic"
            style={{ color: C.text }}
          >
            &ldquo;{data.first_post.text}&rdquo;
          </p>
          <p className="mt-2 text-xs" style={{ color: C.muted }}>
            {new Date(data.first_post.created_at).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Top tags */}
      {data.top_tags.length > 0 && (
        <Panel title={'Words you kept returning to'} C={C}>
          <div className="flex flex-wrap gap-2">
            {data.top_tags.map((tg) => (
              <span
                key={tg.tag}
                className="text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ background: C.chipBg, color: C.accent }}
              >
                #{tg.tag} <span style={{ color: C.muted }}>· {tg.count}</span>
              </span>
            ))}
          </div>
        </Panel>
      )}

      {/* Top categories */}
      {data.top_categories.length > 0 && (
        <Panel title={'The shapes your questions took'} C={C}>
          <div className="space-y-2">
            {data.top_categories.map((c) => (
              <div key={c.category} className="flex items-center justify-between text-sm">
                <span style={{ color: C.text }} className="capitalize">{c.category}</span>
                <span style={{ color: C.muted }}>{c.count}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Closing line */}
      <div
        className="rounded-2xl border p-6 text-center"
        style={{
          borderColor: C.border,
          background: `linear-gradient(135deg, ${C.card}, ${C.chipBg})`,
        }}
      >
        <p className="text-sm md:text-base leading-relaxed" style={{ color: C.text }}>
          {data.posts_count > 0
            ? `You showed up ${data.posts_count} time${data.posts_count === 1 ? '' : 's'} this year. That's ${data.posts_count} small acts of courage.`
            : `You opened ${data.capsules_created} capsule${data.capsules_created === 1 ? '' : 's'} to your future self this year.`}
        </p>
      </div>
    </div>
  );
}

function HeroCard({
  value,
  label,
  accent,
  C,
}: {
  value: string;
  label: string;
  accent: string;
  C: typeof LIGHT;
}) {
  return (
    <div
      className="rounded-2xl border p-6 text-center"
      style={{
        borderColor: C.border,
        background: `linear-gradient(135deg, ${C.card}, ${C.chipBg})`,
      }}
    >
      <p className="text-4xl md:text-6xl font-bold" style={{ color: accent }}>
        {value}
      </p>
      <p className="mt-1 text-xs md:text-sm uppercase tracking-widest" style={{ color: C.muted }}>
        {label}
      </p>
    </div>
  );
}

function StatCard({ value, label, C }: { value: number; label: string; C: typeof LIGHT }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: C.border, background: C.card }}
    >
      <p className="text-2xl md:text-3xl font-bold" style={{ color: C.accent }}>
        {value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wider" style={{ color: C.muted }}>
        {label}
      </p>
    </div>
  );
}

function Panel({
  title,
  C,
  children,
}: {
  title: string;
  C: typeof LIGHT;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: C.border, background: C.card }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-widest mb-3"
        style={{ color: C.muted }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}
