import type { Metadata } from 'next';
import { apiUrl, mediaUrl } from '@/lib/api';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const res = await fetch(apiUrl(`shop/items/${params.id}/`), {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { title: 'Shop Item' };
    const item = await res.json();
    const title: string = item.name || 'Shop Item';
    const description: string = (item.description || '').slice(0, 160);
    const image = mediaUrl(item.cover_url);
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        images: image ? [{ url: image }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    };
  } catch {
    return { title: 'Shop Item' };
  }
}

export default function ShopItemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
