import type { Metadata } from 'next';
import CommunitiesPageClient from '@/components/communities/CommunitiesPageClient';

export const metadata: Metadata = {
  title: 'Communities',
  description: 'Find and join communities of creators building around shared ideas on Cosonova.',
};

export default function CommunitiesPage() {
  return <CommunitiesPageClient />;
}
