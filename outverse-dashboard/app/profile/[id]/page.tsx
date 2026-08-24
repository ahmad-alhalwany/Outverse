import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';
import ProfileView from '@/components/profile/ProfileView';
import { fetchProfilePublic, profileOgMeta } from '@/lib/shareUtils';

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
};

async function resolveId(params: PageProps['params']): Promise<string> {
  const p = await Promise.resolve(params);
  return p.id;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const id = await resolveId(params);
  const profile = await fetchProfilePublic(id);
  if (!profile) {
    return {
      title: 'Profile not found',
      description: 'This cosmic identity could not be found.',
    };
  }
  const og = profileOgMeta(profile);
  return {
    title: og.title,
    description: og.description,
    alternates: { canonical: og.pageUrl },
    openGraph: og.openGraph,
    twitter: og.twitter,
  };
}

export default async function ProfilePage({ params }: PageProps) {
  const id = await resolveId(params);

  if (!id) {
    return (
      <AppShell contentClassName="flex-1 px-4 pt-4 text-center text-text-secondary">
        Invalid profile.
      </AppShell>
    );
  }

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-3xl mx-auto px-4 pb-12">
      <ProfileView userId={id} />
    </AppShell>
  );
}
