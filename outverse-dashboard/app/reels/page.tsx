import type { Metadata } from 'next';
import ReelsPageClient from '@/components/reels/ReelsPageClient';

export const metadata: Metadata = {
  title: 'Discover Signals',
  description: 'Watch short-form video signals from creators across Cosmory — trending clips, moods, and sounds.',
};

export default function ReelsPage() {
  return <ReelsPageClient />;
}
