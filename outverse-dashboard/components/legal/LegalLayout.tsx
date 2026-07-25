'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';

type Section = {
  id: string;
  title: string;
  body: ReactNode;
};

type LegalLayoutProps = {
  title: string;
  updatedLabel: string;
  updatedDate: string;
  backLabel: string;
  sections: Section[];
  related?: { href: string; label: string }[];
};

const PALETTES = {
  light: {
    page: '#F3F0FC',
    card: '#FFFFFF',
    section: '#E9E1FA',
    text: '#211B3D',
    textMuted: '#79709E',
    border: 'rgba(124,58,237,0.14)',
    icon: '#7C3AED',
    strong: '#7C3AED',
  },
  dark: {
    page: '#14102A',
    card: '#1E1740',
    section: '#1E1740',
    text: '#F5F3FF',
    textMuted: '#B0A6D9',
    border: 'rgba(255,255,255,0.06)',
    icon: '#C4B5FD',
    strong: '#C4B5FD',
  },
} as const;

export default function LegalLayout({
  title,
  updatedLabel,
  updatedDate,
  backLabel,
  sections,
  related,
}: LegalLayoutProps) {
  const { theme } = useTheme();
  const { dir } = useLocale();
  const C = PALETTES[theme];

  return (
    <main
      className="min-h-screen px-4 pb-20 pt-8 md:px-6"
      style={{ background: C.page, color: C.text }}
      dir={dir}
    >
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-80"
          style={{ color: C.textMuted }}
        >
          <ArrowLeftIcon className="h-4 w-4 rtl:rotate-180" />
          {backLabel}
        </Link>

        <header className="mt-6 mb-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl" style={{ color: C.text }}>
            {title}
          </h1>
          <p className="mt-2 text-sm" style={{ color: C.textMuted }}>
            {updatedLabel}: {updatedDate}
          </p>
        </header>

        <nav
          className="mb-8 rounded-2xl p-4 md:p-5"
          style={{ background: C.section, border: `1px solid ${C.border}` }}
          aria-label="Sections"
        >
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="hover:underline"
                  style={{ color: C.textMuted }}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="space-y-8">
          {sections.map((s) => (
            <section
              key={s.id}
              id={s.id}
              className="rounded-2xl p-5 md:p-6 scroll-mt-24"
              style={{ background: C.card, border: `1px solid ${C.border}` }}
            >
              <h2 className="text-xl font-semibold mb-2" style={{ color: C.strong }}>
                {s.title}
              </h2>
              <div
                className="text-[0.95rem] leading-relaxed space-y-3"
                style={{ color: C.text }}
              >
                {s.body}
              </div>
            </section>
          ))}
        </article>

        {related && related.length > 0 && (
          <footer
            className="mt-10 rounded-2xl p-5 text-sm"
            style={{ background: C.section, border: `1px solid ${C.border}` }}
          >
            <p className="mb-2 font-semibold" style={{ color: C.text }}>
              {related.length > 1 ? 'See also' : 'See also'}
            </p>
            <ul className="flex flex-wrap gap-3">
              {related.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="hover:underline"
                    style={{ color: C.icon }}
                  >
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </footer>
        )}
      </div>
    </main>
  );
}
