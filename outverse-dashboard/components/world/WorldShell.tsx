'use client';

import AppShell from '@/components/AppShell';

type WorldShellProps = {
  children: React.ReactNode;
  colors: { cream: string; text: string; brown?: string };
  maxWidth?: string;
  /** Soft radial glow atmosphere behind world pages */
  atmosphere?: boolean;
};

/** App layout for Lab, Bazaar, Shop, Forge — shared Header + Sidebar. */
export default function WorldShell({
  children,
  colors,
  maxWidth = 'max-w-7xl',
  atmosphere = true,
}: WorldShellProps) {
  const accent = colors.brown || '#7C3AED';
  const bg = atmosphere
    ? {
        backgroundColor: colors.cream,
        backgroundImage: `radial-gradient(ellipse 80% 55% at 12% -10%, ${accent}28, transparent 55%), radial-gradient(ellipse 60% 40% at 92% 8%, ${accent}18, transparent 50%)`,
      }
    : { background: colors.cream };

  return (
    <AppShell
      className="min-h-screen"
      style={{ ...bg, color: colors.text }}
      maxWidth={maxWidth}
      contentClassName="flex-1 min-w-0 w-full px-3 sm:px-4 pb-12 relative"
    >
      {children}
    </AppShell>
  );
}
