import type { Metadata } from 'next';
import { apiUrl, mediaUrl } from '@/lib/api';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const res = await fetch(apiUrl(`users/${params.id}/`), {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { title: 'Profile' };
    const user = await res.json();
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
    const title = fullName || user.username || 'Profile';
    const description: string = (user.bio || '').slice(0, 160);
    const image = mediaUrl(user.avatar);
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'profile',
        images: image ? [{ url: image }] : undefined,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    };
  } catch {
    return { title: 'Profile' };
  }
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
