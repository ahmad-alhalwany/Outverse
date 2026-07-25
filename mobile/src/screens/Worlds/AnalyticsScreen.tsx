import React from 'react';
import { api } from '@/api/client';
import { WorldStatsScreen } from './WorldScreenKit';

export default function AnalyticsScreen() {
  return (
    <WorldStatsScreen
      title="Analytics"
      subtitle="Creator metrics"
      tone="lab"
      heroTitle="Analytics snapshot"
      heroBody="A thin analytics/me dashboard with a shortcut into Creator Studio."
      load={() => api.getMeAnalytics()}
      linkLabel="Creator Studio"
      onLink={(navigation) => navigation.navigate('CreatorStudio')}
    />
  );
}
