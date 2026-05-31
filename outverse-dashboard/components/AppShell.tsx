'use client';

import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';

type AppShellProps = {
  children: React.ReactNode;
  /** Classes on outer `<main>` */
  className?: string;
  /** Extra classes on the content column (right of sidebar) */
  contentClassName?: string;
  /** Max width of the shell row (default max-w-7xl) */
  maxWidth?: string;
  style?: React.CSSProperties;
};

/**
 * Standard Outverse layout: Header + optional Sidebar (lg+) + content.
 * No fixed marginLeft — on mobile the sidebar is hidden and content is full width.
 */
export default function AppShell({
  children,
  className = 'min-h-screen bg-background text-text',
  contentClassName = 'flex-1 min-w-0 w-full px-4 pb-12',
  maxWidth = 'max-w-7xl',
  style,
}: AppShellProps) {
  return (
    <main className={className} style={style}>
      <Header />
      <div className={`app-shell pt-20 ${maxWidth} mx-auto flex w-full min-w-0`}>
        <Sidebar />
        <div className={contentClassName}>{children}</div>
      </div>
    </main>
  );
}
