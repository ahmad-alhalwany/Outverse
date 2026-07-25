import type { Metadata } from 'next';
import { fetchPostPublic, postOgMeta } from '@/lib/shareUtils';
import PostDetailView from '@/components/posts/PostDetailView';

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
};

async function resolveId(params: PageProps['params']): Promise<string> {
  const p = await Promise.resolve(params);
  return p.id;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = await resolveId(params);
  const post = await fetchPostPublic(id);
  if (!post) {
    return {
      title: 'Signal not found | Cosmory',
      description: 'This transmission drifted out of orbit.',
    };
  }
  const og = postOgMeta(post);
  return {
    title: og.title,
    description: og.description,
    alternates: { canonical: og.pageUrl },
    openGraph: og.openGraph,
    twitter: og.twitter,
  };
}

export default async function PostDetailPage({ params }: PageProps) {
  const id = await resolveId(params);
  return <PostDetailView postId={id} />;
}
