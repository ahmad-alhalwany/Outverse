'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '🏠' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/chat', label: 'Chat', icon: '💬' },
  { href: '/admin/challenges', label: 'Challenges', icon: '🎯' },
  { href: '/admin/moderation', label: 'Moderation', icon: '🚩' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📊' },
  { href: '/admin/health', label: 'Health', icon: '💻' },
  { href: '/admin/audit', label: 'Audit', icon: '📜' },
];

export default function AdminShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        className="sidebar"
        style={{
          width: open ? 220 : 64,
          transition: 'width 0.2s',
          borderRight: '1px solid #23234A',
          padding: open ? 24 : 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
          <h2
            style={{
              fontWeight: 700,
              fontSize: 24,
              flex: 1,
              opacity: open ? 1 : 0,
              transition: 'opacity 0.2s',
            }}
          >
            Outverse Admin
          </h2>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            style={{
              background: 'none',
              border: 'none',
              color: '#F5F6FA',
              fontSize: 22,
              cursor: 'pointer',
            }}
            title="Toggle sidebar"
          >
            {open ? '⏪' : '⏩'}
          </button>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                color: pathname === link.href ? '#FF3B3B' : '#F5F6FA',
                textDecoration: 'none',
                fontWeight: pathname === link.href ? 700 : 500,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: pathname === link.href ? '#23234A' : 'none',
                borderRadius: 8,
                padding: open ? '6px 12px' : '6px',
              }}
            >
              <span>{link.icon}</span>
              {open && link.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/"
          style={{
            display: 'block',
            marginTop: 24,
            fontSize: 12,
            color: '#aaa',
            textDecoration: 'none',
          }}
        >
          ← Main app
        </Link>
      </aside>
      <main style={{ flex: 1, padding: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>{title}</h1>
        {children}
      </main>
    </div>
  );
}
