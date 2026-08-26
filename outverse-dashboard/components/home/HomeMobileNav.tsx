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
import { MORE_NAV_LINKS, SETTINGS_NAV_LINK } from '@/lib/navLinks';

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
  { nameKey: 'nav.discover', href: '/discover', icon: MagnifyingGlassIcon },
  ...MORE_NAV_LINKS,
  SETTINGS_NAV_LINK,
];

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
  const moreActive = MORE_LINKS.some((link) => pathname.startsWith(link.href));

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

            {/* Sheet */}
            <motion.div
              ref={sheetRef}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-[61] rounded-t-3xl border-t border-vault/20 bg-background/98 backdrop-blur-xl shadow-[0_-20px_60px_rgba(0,0,0,0.4)]"
              role="dialog"
              aria-modal="true"
              aria-label="More navigation"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <span className="w-10 h-1 rounded-full bg-text-secondary/30" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3 border-b border-surface">
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

              {/* Grid of links */}
              <div className="grid grid-cols-4 gap-3 p-4 pb-8 safe-area-pb">
                {MORE_LINKS.map((link) => {
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
