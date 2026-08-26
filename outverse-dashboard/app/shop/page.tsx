import type { Metadata } from 'next';
import ShopPageClient from '@/components/shop/ShopPageClient';

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Browse art, templates, stories, designs, and other creations from Cosonova creators.',
};

export default function ShopPage() {
  return <ShopPageClient />;
}
