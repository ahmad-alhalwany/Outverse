'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  HomeIcon,
  BeakerIcon,
  UserCircleIcon,
  RectangleStackIcon,
  XMarkIcon,
  Squares2X2Icon,
  BellIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import ReelsIcon from '@/components/icons/ReelsIcon';
import { useProfileHref } from '@/lib/hooks/useAuthUser';
import { useDialogA11y } from '@/lib/hooks/useDialogA11y';
import { useLocale } from '@/components/LocaleProvider';
import { MORE_NAV_LINKS, SETTINGS_NAV_LINK, type NavSection } from '@/lib/navLinks';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
  match: (p: string) => boolean;
  reelsIcon?: boolean;
};

// Discover isn't in the shared "More" list (it's a top-level tab on desktop),
// but mobile has no room for it as its own tab, so it leads the sheet here.
const MORE_LINKS = [
  { nameKey: 'nav.discover', href: '/discover', icon: MagnifyingGlassIcon, section: 'explore' as const },
  ...MORE_NAV_LINKS,
];

// Settings is pinned outside the scrolling sections below, same as the
// desktop Sidebar pins it below the accordion.
const ALL_MORE_HREFS = [...MORE_LINKS, SETTINGS_NAV_LINK];

const SECTION_ORDER: NavSection[] = ['create', 'explore', 'social', 'commerce', 'library', 'stats'];
const SECTION_LABEL_KEY: Record<NavSection, string> = {
  create: 'nav.sectionCreate',
  explore: 'nav.sectionExplore',
  social: 'nav.sectionSocial',
  commerce: 'nav.sectionCommerce',
  library: 'nav.sectionLibrary',
  stats: 'nav.sectionStats',
};

export default function HomeMobileNav() {
  const pathname = usePathname();
  const profileHref = useProfileHref();
  const { t } = useLocale();
  const [moreOpen, setMoreOpen] = useState(false);

  const items: NavItem[] = [
    { href: '/', label: t('nav.home'), icon: HomeIcon, match: (p: string) => p === '/' },
    { href: '/reels', label: t('nav.reels'), icon: RectangleStackIcon, match: (p: string) => p.startsWith('/reels'), reelsIcon: true },
    { href: '/lab', label: t('nav.lab'), icon: BeakerIcon, match: (p: string) => p.startsWith('/lab') },
    { href: profileHref, label: t('nav.profile'), icon: UserCircleIcon, match: (p: string) => p.startsWith('/profile') || p.startsWith('/u/') },
  ];

  // Close sheet on route change
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (moreOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [moreOpen]);

  const sheetRef = useDialogA11y<HTMLDivElement>(moreOpen, () => setMoreOpen(false));

  // Check if current path is in the "more" links
  const moreActive = ALL_MORE_HREFS.some((link) => pathname.startsWith(link.href));

  const sections = SECTION_ORDER.map((key) => ({
    key,
    links: MORE_LINKS.filter((link) => link.section === key),
  })).filter((section) => section.links.length > 0);

  const SettingsIcon = SETTINGS_NAV_LINK.icon;
  const settingsActive = pathname.startsWith(SETTINGS_NAV_LINK.href);

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-vault/15 bg-background/95 backdrop-blur-lg safe-area-pb"
        aria-label={t('nav.mainNavigation')}
      >
        <div className="flex items-center justify-around py-1.5 px-1.5">
          {items.slice(0, 4).map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-0.5 min-w-[3rem] py-1 text-[10px] font-medium transition relative"
                style={{ color: active ? 'var(--c-icon-hover)' : 'var(--c-text-secondary)' }}
                aria-current={active ? 'page' : undefined}
              >
                <span className={`p-1 rounded-lg transition-colors ${active ? 'bg-vault/15' : ''}`}>
                  {item.reelsIcon ? (
                    <ReelsIcon size={20} active={active} />
                  ) : (
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  )}
                </span>
                {item.label}
                {active && (
                  <motion.span
                    layoutId="mobileNavActive"
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-vault"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}

          {/* More button */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 min-w-[3rem] py-1 text-[10px] font-medium transition"
            style={{ color: moreActive ? 'var(--c-icon-hover)' : 'var(--c-text-secondary)' }}
            aria-label={t('nav.moreNavigation')}
            aria-expanded={moreOpen}
          >
            <span className={`p-1 rounded-lg transition-colors ${moreActive ? 'bg-vault/15' : ''}`}>
              <Squares2X2Icon className="h-5 w-5" strokeWidth={1.8} />
            </span>
            {t('nav.more')}
          </button>
        </div>
      </nav>

      {/* Bottom Sheet for "More" links */}
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="lg:hidden fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
              onClick={() => setMoreOpen(false)}
            />

            {/* Sheet — capped height with its own scroll area, so it never
                covers the whole screen; header and Settings stay pinned. */}
            <motion.div
              ref={sheetRef}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-[61] max-h-[75vh] flex flex-col rounded-t-3xl border-t border-vault/20 bg-background/98 backdrop-blur-xl shadow-[0_-20px_60px_rgba(0,0,0,0.4)]"
              role="dialog"
              aria-modal="true"
              aria-label="More navigation"
            >
              {/* Drag handle */}
              <div className="shrink-0 flex justify-center pt-3 pb-1">
                <span className="w-10 h-1 rounded-full bg-text-secondary/30" />
              </div>

              {/* Header */}
              <div className="shrink-0 flex items-center justify-between px-5 pb-3 border-b border-surface">
                <h2 className="text-base font-bold text-text">{t('nav.mainNavigation')}</h2>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="icon-only p-2"
                  aria-label="Close menu"
                >
                  <XMarkIcon className="h-5 w-5" strokeWidth={1.8} />
                </button>
              </div>

              {/* Scrollable, grouped grid of links */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
                {sections.map((section) => (
                  <div key={section.key}>
                    <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary/80">
                      {t(SECTION_LABEL_KEY[section.key])}
                    </h3>
                    <div className="grid grid-cols-4 gap-3">
                      {section.links.map((link) => {
                        const Icon = link.icon;
                        const active = pathname.startsWith(link.href);
                        return (
                          <Link
                            key={link.nameKey}
                            href={link.href}
                            className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition active:scale-95 focus-visible:ring-2 focus-visible:ring-vault outline-none"
                            style={{
                              background: active ? 'rgba(124, 58, 237, 0.12)' : 'rgba(255,255,255,0.03)',
                            }}
                          >
                            {Icon && (
                              <Icon
                                className="h-6 w-6"
                                strokeWidth={1.8}
                                style={{ color: active ? 'var(--c-icon-hover)' : 'var(--c-icon)' }}
                              />
                            )}
                            <span className="text-[10px] font-medium text-center leading-tight" style={{ color: 'var(--c-text)' }}>
                              {t(link.nameKey)}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Settings — pinned below the scroll area, like desktop's bottomLinks */}
              <div className="shrink-0 border-t border-surface p-3 safe-area-pb">
                <Link
                  href={SETTINGS_NAV_LINK.href}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-vault outline-none"
                  style={{ background: settingsActive ? 'rgba(124, 58, 237, 0.12)' : 'transparent' }}
                >
                  {SettingsIcon && (
                    <SettingsIcon
                      className="h-5 w-5"
                      strokeWidth={1.8}
                      style={{ color: settingsActive ? 'var(--c-icon-hover)' : 'var(--c-icon)' }}
                    />
                  )}
                  <span className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>
                    {t(SETTINGS_NAV_LINK.nameKey)}
                  </span>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
