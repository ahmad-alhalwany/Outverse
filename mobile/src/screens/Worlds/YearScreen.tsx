import React from 'react';
import { api } from '@/api/client';
import { WorldStatsScreen } from './WorldScreenKit';

export default function YearScreen() {
  return (
    <WorldStatsScreen
      title="Year"
      subtitle="Annual stats"
      tone="vault"
      heroTitle="Your year in Cosonova"
      heroBody="A lightweight mobile view of your annual activity, worlds, and milestones."
      load={() => api.getYearStats()}
    />
  );
}
