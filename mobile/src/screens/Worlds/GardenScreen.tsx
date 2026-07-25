import React from 'react';
import { api } from '@/api/client';
import { WorldListScreen } from './WorldScreenKit';

export default function GardenScreen() {
  return (
    <WorldListScreen
      title="Garden"
      subtitle="New ideas"
      tone="bazaar"
      heroTitle="Fresh seeds from the idea garden"
      heroBody="The newest public ideas ordered by creation time."
      load={() => api.getIdeas({ ordering: 'new' })}
      emptyText="No ideas planted yet"
      onPressRow={(row, navigation) => navigation.navigate('BazaarDetail', { ideaId: row.id })}
    />
  );
}
