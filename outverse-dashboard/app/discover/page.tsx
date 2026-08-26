import type { Metadata } from 'next';
import DiscoverPageClient from '@/components/discover/DiscoverPageClient';

export const metadata: Metadata = {
  title: 'Discover',
  description: 'Explore trending posts, topics, communities, creators, and signals across Cosonova.',
};

export default function DiscoverPage() {
  return <DiscoverPageClient />;
}
