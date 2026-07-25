import React from 'react';
import { api } from '@/api/client';
import { WorldListScreen } from './WorldScreenKit';

export default function ForgeScreen() {
  return (
    <WorldListScreen
      title="Forge"
      subtitle="Stories"
      tone="bazaar"
      heroTitle="Forge long-form stories"
      heroBody="Create story shells and open them to add segments or publish."
      load={() => api.getForgeStories()}
      createLabel="Create story"
      createPlaceholder="Story title"
      createPayload={(text) => ({ title: text })}
      create={(payload) => api.createForgeStory(payload)}
      emptyText="No forged stories yet"
      onPressRow={(row, navigation) => navigation.navigate('ForgeDetail', { storyId: row.id })}
    />
  );
}
