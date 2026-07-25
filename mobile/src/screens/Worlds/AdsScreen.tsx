import React from 'react';
import { api } from '@/api/client';
import { WorldListScreen } from './WorldScreenKit';

export default function AdsScreen() {
  return (
    <WorldListScreen
      title="Ads"
      subtitle="Campaigns"
      tone="shop"
      heroTitle="Campaign controls"
      heroBody="List campaigns and pause or resume when those endpoints are mounted."
      load={() => api.getAdCampaigns()}
      emptyText="No campaigns yet"
      actions={[
        { label: 'Pause', run: (row) => api.pauseAdCampaign(row.id) },
        { label: 'Resume', run: (row) => api.resumeAdCampaign(row.id) },
      ]}
    />
  );
}
