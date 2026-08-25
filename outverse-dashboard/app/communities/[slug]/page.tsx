import type { Metadata } from 'next';
import CommunityDetailView from '@/components/communities/CommunityDetailView';
import { fetchCommunityPublic, communityOgMeta } from '@/lib/shareUtils';

type PageProps = {
  params: Promise<{ slug: string }> | { slug: string };
};

async function resolveSlug(params: PageProps['params']): Promise<string> {
  const p = await Promise.resolve(params);
  return decodeURIComponent(p.slug);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = await resolveSlug(params);
  const community = await fetchCommunityPublic(slug);
  if (!community) {
    return {
      title: 'Community not found',
      description: 'This community could not be found.',
    };
  }
  const og = communityOgMeta(community);
  return {
    title: og.title,
    description: og.description,
    alternates: { canonical: og.pageUrl },
    openGraph: og.openGraph,
    twitter: og.twitter,
  };
}

export default async function CommunityDetailPage({ params }: PageProps) {
  const slug = await resolveSlug(params);
  return <CommunityDetailView slug={slug} />;
}
