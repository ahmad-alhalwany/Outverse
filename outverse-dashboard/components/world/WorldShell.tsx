'use client';

import AppShell from '@/components/AppShell';

type WorldShellProps = {
  children: React.ReactNode;
  colors: { cream: string; text: string };
  maxWidth?: string;
};

/** App layout for Lab, Bazaar, Shop, Forge — shared Header + Sidebar. */
export default function WorldShell({
  children,
  colors,
  maxWidth = 'max-w-7xl',
}: WorldShellProps) {
  return (
    <AppShell
      className="min-h-screen"
      style={{ background: colors.cream, color: colors.text }}
      maxWidth={maxWidth}
      contentClassName="flex-1 min-w-0 w-full px-3 sm:px-4 pb-12"
    >
      {children}
    </AppShell>
  );
}
