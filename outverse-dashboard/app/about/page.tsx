import type { Metadata } from 'next';
import AboutPageClient from '@/components/legal/AboutPageClient';

export const metadata: Metadata = {
  title: 'About',
  description: 'Cosonova is a creative social platform where you post ideas, join communities, share short-form video, and sell your work.',
};

export default function AboutPage() {
  return <AboutPageClient />;
}
