import React from 'react';
import { api } from '@/api/client';
import { WorldListScreen } from './WorldScreenKit';

export default function MemoriesScreen() {
  return (
    <WorldListScreen
      title="Memories"
      subtitle="Future memories"
      tone="vault"
      heroTitle="Messages to a future self"
      heroBody="Read and create speculative future memories from mobile."
      load={() => api.getFutureMemories()}
      createLabel="Add memory"
      createPlaceholder="Write a future memory"
      createPayload={(text) => ({ text, title: text.slice(0, 48) })}
      create={(payload) => api.createFutureMemory(payload)}
      emptyText="No future memories yet"
    />
  );
}
