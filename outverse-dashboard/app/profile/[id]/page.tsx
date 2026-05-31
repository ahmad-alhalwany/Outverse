'use client';

import { useParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import ProfileView from '@/components/profile/ProfileView';

export default function ProfilePage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

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
