import type { Metadata } from 'next';
import SearchPageClient from '@/components/search/SearchPageClient';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search creators, posts, ideas, stories, challenges, signals, and shop items on Cosmory.',
};

export default function SearchPage() {
  return <SearchPageClient />;
}
