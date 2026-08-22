import type { Metadata } from 'next';
import { apiUrl, mediaUrl } from '@/lib/api';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const res = await fetch(apiUrl(`forge/stories/${params.id}/`), {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { title: 'Story' };
    const story = await res.json();
    const title: string = story.title || 'Story';
    const description: string = (story.premise || '').slice(0, 160);
    const image = mediaUrl(story.cover_url);
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
    return { title: 'Story' };
  }
}

export default function ForgeStoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
