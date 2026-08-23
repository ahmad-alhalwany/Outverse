import type { ReactNode } from 'react';

export default function EmptyState({
  icon, title, subtitle, action,
}: { icon?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="empty-feed rounded-2xl py-16 px-6 text-center">
      {icon && <p className="text-4xl mb-3">{icon}</p>}
      <p className="font-semibold text-text mb-2">{title}</p>
      {subtitle && <p className="text-sm text-text-secondary max-w-sm mx-auto mb-4">{subtitle}</p>}
      {action}
    </div>
  );
}
