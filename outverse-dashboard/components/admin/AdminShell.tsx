'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { getUser } from '@/lib/auth';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '🏠' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📊' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/shop', label: 'Madness Shop', icon: '🛒' },
  { href: '/admin/reels', label: 'Signals', icon: '📡' },
  { href: '/admin/challenges', label: 'Lab', icon: '🎯' },
  { href: '/admin/achievements', label: 'Achievements', icon: '🏆' },
  { href: '/admin/moderation', label: 'Moderation', icon: '🚩' },
  { href: '/admin/chat', label: 'Chat', icon: '💬' },
  { href: '/admin/health', label: 'Health', icon: '💻' },
  { href: '/admin/audit', label: 'Audit', icon: '📜' },
];

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
  const [collapsed, setCollapsed] = useState(false);
  const me = getUser();

  return (
    <div className={`admin-root admin-shell${collapsed ? ' admin-sidebar--collapsed-parent' : ''}`}>
      <aside className={`admin-sidebar${collapsed ? ' admin-sidebar--collapsed' : ''}`}>
        <div className="admin-sidebar__brand">
          {!collapsed && <span>Outverse Admin</span>}
          <button
            type="button"
            className="admin-sidebar__toggle"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
          >
            {collapsed ? '⏩' : '⏪'}
          </button>
        </div>
        <nav>
          {NAV.map((link) => {
            const active =
              link.href === '/admin'
                ? pathname === '/admin'
                : pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`admin-nav-link${active ? ' admin-nav-link--active' : ''}`}
                title={link.label}
              >
                <span>{link.icon}</span>
                {!collapsed && <span>{link.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          {!collapsed && me && (
            <p style={{ fontSize: '0.72rem', color: 'var(--admin-muted)', marginBottom: '0.5rem' }}>
              @{me.username}
            </p>
          )}
          <Link href="/" className="admin-nav-link" style={{ fontSize: '0.78rem' }}>
            <span>←</span>
            {!collapsed && <span>Main app</span>}
          </Link>
        </div>
      </aside>
      <div className="admin-main">
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
