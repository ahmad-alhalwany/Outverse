import type { Metadata } from 'next';
import { apiUrl, mediaUrl } from '@/lib/api';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const res = await fetch(apiUrl(`ideas/${params.id}/`), {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { title: 'Idea' };
    const idea = await res.json();
    const title: string = idea.title || 'Idea';
    const description: string = (idea.description || '').slice(0, 160);
    const image = mediaUrl(idea.cover_url);
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        images: image ? [{ url: image }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    };
  } catch {
    return { title: 'Idea' };
  }
}

export default function BazaarItemLayout({ children }: { children: React.ReactNode }) {
  return children;
}
