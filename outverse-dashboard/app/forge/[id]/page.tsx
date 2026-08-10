'use client';

import ForgeStoryStudio from '@/components/forge/ForgeStoryStudio';

export default function ForgeStoryPage({
  params,
}: {
  params: { id: string };
}) {
  const storyId = Number(params.id);
  if (!Number.isFinite(storyId)) {
    return <p className="p-8 text-center text-sm">Invalid story id</p>;
  }
  return <ForgeStoryStudio storyId={storyId} />;
}
