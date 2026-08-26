import type { Metadata } from 'next';
import FaqPageClient from '@/components/legal/FaqPageClient';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers to common questions about Cosonova coins, the Bazaar, the Shop, creator subscriptions, and communities.',
};

export default function FaqPage() {
  return <FaqPageClient />;
}
