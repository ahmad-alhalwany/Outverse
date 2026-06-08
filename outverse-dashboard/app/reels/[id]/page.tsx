import type { Metadata } from 'next';
import { fetchReelPublic, reelOgMeta } from '@/lib/fetchReel';
import ReelDetailView from '@/components/reels/ReelDetailView';

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
};

async function resolveId(params: PageProps['params']): Promise<string> {
  const p = await Promise.resolve(params);
  return p.id;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = await resolveId(params);
  const reel = await fetchReelPublic(id);
  if (!reel) {
    return {
      title: 'Signal not found | Outverse',
      description: 'This cosmic signal is no longer in orbit.',
    };
  }
  const og = reelOgMeta(reel);
  return {
    title: og.title,
    description: og.description,
    alternates: { canonical: og.pageUrl },
    openGraph: og.openGraph,
    twitter: og.twitter,
  };
}

export default async function ReelDetailPage({ params }: PageProps) {
  const id = await resolveId(params);
  return <ReelDetailView reelId={id} />;
}
