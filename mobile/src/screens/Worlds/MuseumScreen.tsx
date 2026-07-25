import React from 'react';
import { api } from '@/api/client';
import { WorldListScreen } from './WorldScreenKit';

export default function MuseumScreen() {
  return (
    <WorldListScreen
      title="Museum"
      subtitle="Failed ideas"
      tone="bazaar"
      heroTitle="Archive ideas worth learning from"
      heroBody="Create and browse failed ideas without leaving mobile."
      load={() => api.getFailedIdeas()}
      createLabel="Add idea"
      createPlaceholder="What failed?"
      createPayload={(text) => ({ title: text, description: '' })}
      create={(payload) => api.createFailedIdea(payload)}
      emptyText="No failed ideas archived yet"
    />
  );
}
