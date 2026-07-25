'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { getUser } from '@/lib/auth';
import { useLocale } from '@/components/LocaleProvider';

const THEME_KEY = 'cosmory-admin-theme';

const NAV = [
  { href: '/admin/posts', labelKey: 'admin.navPosts', icon: '📝' },
  { href: '/admin/forge', labelKey: 'admin.navForge', icon: '✍️' },
  { href: '/admin/notifications', labelKey: 'admin.navBroadcast', icon: '📣' },
  { href: '/admin', labelKey: 'admin.navDashboard', icon: '🏠' },
  { href: '/admin/analytics', labelKey: 'admin.navAnalytics', icon: '📊' },
  { href: '/admin/users', labelKey: 'admin.navUsers', icon: '👥' },
  { href: '/admin/bazaar', labelKey: 'admin.navBazaar', icon: '💡' },
  { href: '/admin/vault', labelKey: 'admin.navVault', icon: '🍾' },
  { href: '/admin/shop', labelKey: 'admin.navShop', icon: '🛒' },
  { href: '/admin/ads', labelKey: 'admin.navAds', icon: '📢' },
  { href: '/admin/reels', labelKey: 'admin.navReels', icon: '📡' },
  { href: '/admin/challenges', labelKey: 'admin.navLab', icon: '🎯' },
  { href: '/admin/achievements', labelKey: 'admin.navAchievements', icon: '🏆' },
  { href: '/admin/moderation', labelKey: 'admin.navModeration', icon: '🚩' },
  { href: '/admin/verification', labelKey: 'admin.navVerification', icon: '✅' },
  { href: '/admin/chat', labelKey: 'admin.navChat', icon: '💬' },
  { href: '/admin/health', labelKey: 'admin.navHealth', icon: '💻' },
  { href: '/admin/audit', labelKey: 'admin.navAudit', icon: '📜' },
] as const;

export default function AdminShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useLocale();
  const [collapsed, setCollapsed] = useState(false);
  const [lightTheme, setLightTheme] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const me = getUser();

  useEffect(() => {
    setLightTheme(localStorage.getItem(THEME_KEY) === 'light');
    setAlertDismissed(sessionStorage.getItem('cosmory-admin-alert-dismissed') === '1');
  }, []);

  function toggleTheme() {
    const next = !lightTheme;
    setLightTheme(next);
    localStorage.setItem(THEME_KEY, next ? 'light' : 'dark');
  }

  function dismissAlert() {
    setAlertDismissed(true);
    sessionStorage.setItem('cosmory-admin-alert-dismissed', '1');
  }

  return (
    <div className={`admin-root admin-shell${collapsed ? ' admin-sidebar--collapsed-parent' : ''}${lightTheme ? ' admin-root--light' : ''}`}>
      <aside className={`admin-sidebar${collapsed ? ' admin-sidebar--collapsed' : ''}`}>
        <div className="admin-sidebar__brand">
          {!collapsed && <span>{t('admin.panelTitle')}</span>}
          <button
            type="button"
            className="admin-sidebar__toggle"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? t('admin.expandNav') : t('admin.collapseNav')}
          >
            {collapsed ? '⏩' : '⏪'}
          </button>
        </div>
        <button
          type="button"
          className="admin-nav-link"
          style={{ fontSize: '0.78rem', width: '100%', textAlign: 'left' }}
          onClick={toggleTheme}
        >
          <span>{lightTheme ? '🌙' : '☀️'}</span>
          {!collapsed && <span>{lightTheme ? t('admin.darkTheme') : t('admin.lightTheme')}</span>}
        </button>
        <nav aria-label={t('admin.panelTitle')}>
          {NAV.map((link) => {
            const active =
              link.href === '/admin'
                ? pathname === '/admin'
                : pathname?.startsWith(link.href);
            const label = t(link.labelKey);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`admin-nav-link${active ? ' admin-nav-link--active' : ''}`}
                title={label}
                aria-current={active ? 'page' : undefined}
              >
                <span>{link.icon}</span>
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          {!collapsed && me && (
            <p style={{ fontSize: '0.72rem', color: 'var(--admin-muted)', marginBottom: '0.5rem' }}>
              {t('admin.signedInAs')} @{me.username}
            </p>
          )}
          <Link href="/" className="admin-nav-link" style={{ fontSize: '0.78rem' }}>
            <span>←</span>
            {!collapsed && <span>Main app</span>}
          </Link>
        </div>
      </aside>
      <div className="admin-main">
        {!alertDismissed && (
          <div className="admin-alert admin-alert--warning">
            <span>🛡️ Unusual login activity detected on 2 accounts in the last 24 hours. Review the audit log for details.</span>
            <button type="button" onClick={dismissAlert} aria-label={t('admin.dismissAlert')}>✕</button>
          </div>
        )}
        <div className="admin-page-head">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}
