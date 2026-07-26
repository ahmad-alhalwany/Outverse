import React from 'react';
import { api } from '@/api/client';
import { WorldListScreen } from './WorldScreenKit';

function growthStage(row: Record<string, any>) {
  const supporters = Number(row.supporters_count ?? row.votes_count ?? row.likes_count ?? 0);
  const funding = Number(row.funding_raised ?? row.pledged_amount ?? row.total_pledged ?? 0);
  const score = supporters + Math.min(20, Math.floor(funding / 10));
  if (score >= 40) return { emoji: '🌳', label: 'Canopy' };
  if (score >= 18) return { emoji: '🌿', label: 'Sprout' };
  if (score >= 6) return { emoji: '🌱', label: 'Seedling' };
  return { emoji: '🌰', label: 'Seed' };
}

export default function GardenScreen() {
  return (
    <WorldListScreen
      title="Garden"
      subtitle="New ideas"
      tone="bazaar"
      heroTitle="Fresh seeds from the idea garden"
      heroBody="Newest public ideas, shown as growth stages based on support and pledges."
      load={() => api.getIdeas({ ordering: 'new' })}
      emptyText="No ideas planted yet"
      onPressRow={(row, navigation) => navigation.navigate('BazaarDetail', { ideaId: row.id })}
      rowTitle={(row) => {
        const stage = growthStage(row);
        return `${stage.emoji} ${row.title || 'Untitled idea'}`;
      }}
      rowSubtitle={(row) => String(row.description || row.summary || '')}
      rowMeta={(row) => {
        const stage = growthStage(row);
        const supporters = row.supporters_count ?? row.votes_count ?? 0;
        return `${stage.label} · ${supporters} supporters`;
      }}
    />
  );
}
